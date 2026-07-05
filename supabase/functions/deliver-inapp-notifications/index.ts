import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { buildInAppMessage } from '../_shared/inapp-templates.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

Deno.serve(async (req: Request) => {
  const secret = Deno.env.get('SYNC_SECRET')
  if (secret && req.headers.get('x-sync-secret') !== secret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Missing environment variables' }), { status: 500 })
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const workerId = 'inapp-worker-' + crypto.randomUUID()

  // Claim pending/failed in-app notifications from the queue (up to 10)
  const { data: claimed, error: claimErr } = await sb.rpc('claim_due_notifications', {
    p_channel: 'in_app',
    p_worker_id: workerId,
    p_limit: 10
  })

  if (claimErr) {
    return new Response(JSON.stringify({ error: 'Failed to claim notifications', detail: claimErr.message }), { status: 500 })
  }

  if (!claimed || claimed.length === 0) {
    return new Response(JSON.stringify({ message: 'No in-app notifications due' }), { headers: { 'Content-Type': 'application/json' } })
  }

  let sentCount = 0
  const errors: string[] = []

  for (const item of claimed) {
    let errorMsg: string | null = null

    try {
      const profileId = item.profile_id
      if (!profileId) throw new Error('Missing profile_id for in-app notification')

      const templateVal = buildInAppMessage(item.type, item.payload)
      const title = item.payload.title || templateVal.title
      const message = item.payload.message || item.payload.body || templateVal.message || 'Your document is expiring soon.'
      const action_url = item.payload.action_url || templateVal.action_url

      const { error: insertErr } = await sb
        .from('member_notifications')
        .insert({
          profile_id: profileId,
          type: item.type,
          title,
          message,
          action_url,
          is_read: false
        })

      if (insertErr) throw new Error(`Insert failed: ${insertErr.message}`)

      // Success: update queue status and log delivery
      await sb
        .from('notification_queue')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', item.id)

      await sb.from('notification_delivery_log').insert({
        queue_id: item.id,
        channel: 'in_app',
        template: item.type,
        recipient: profileId,
        status: 'sent',
        payload: item.payload,
      })

      sentCount++
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : String(err)
      errors.push(`In-app notification failed for item ${item.id}: ${errorMsg}`)

      const attempts = item.attempts || 1
      const maxAttempts = item.max_attempts || 5
      const nextStatus = attempts >= maxAttempts ? 'permanently_failed' : 'failed'

      const backoffMs = 1000 * Math.pow(2, attempts)
      const nextSendAt = new Date(Date.now() + backoffMs).toISOString()

      await sb
        .from('notification_queue')
        .update({
          status: nextStatus,
          attempts: attempts,
          last_error: errorMsg,
          send_at: nextSendAt,
        })
        .eq('id', item.id)

      await sb.from('notification_delivery_log').insert({
        queue_id: item.id,
        channel: 'in_app',
        template: item.type,
        recipient: item.profile_id || 'unknown',
        status: 'failed',
        error: errorMsg,
        payload: item.payload,
      })
    }
  }

  return new Response(JSON.stringify({ sent_count: sentCount, total: claimed.length, errors }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
