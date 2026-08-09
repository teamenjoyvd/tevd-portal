import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { buildReminderEmail, buildHtmlEmail } from '../_shared/email-templates.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

Deno.serve(async (req: Request) => {
  const secret = Deno.env.get('SYNC_SECRET')
  if (!secret || req.headers.get('x-sync-secret') !== secret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'Missing environment variables' }), { status: 500 })
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const workerId = 'email-worker-' + crypto.randomUUID()

  // Claim pending/failed email notifications from the queue (up to 10)
  const { data: claimed, error: claimErr } = await sb.rpc('claim_due_notifications', {
    p_channel: 'email',
    p_worker_id: workerId,
    p_limit: 10
  })

  if (claimErr) {
    return new Response(JSON.stringify({ error: 'Failed to claim notifications', detail: claimErr.message }), { status: 500 })
  }

  if (!claimed || claimed.length === 0) {
    return new Response(JSON.stringify({ message: 'No email notifications due' }), { headers: { 'Content-Type': 'application/json' } })
  }

  let sentCount = 0
  const errors: string[] = []

  for (const item of claimed) {
    let resendId: string | null = null
    let errorMsg: string | null = null
    const recipient: string | undefined = item.payload.email

    // No recipient in the payload — never attempt a send to a placeholder
    // string (Resend 422s on it), skip straight to the failure path instead.
    if (!recipient) {
      errorMsg = 'Missing recipient email in payload'
      errors.push(`Email failed for item ${item.id}: ${errorMsg}`)

      const attempts = item.attempts || 1
      const maxAttempts = item.max_attempts || 3
      const nextStatus = attempts >= maxAttempts ? 'permanently_failed' : 'failed'
      const backoffMs = 1000 * Math.pow(2, attempts)
      const nextSendAt = new Date(Date.now() + backoffMs).toISOString()

      await sb
        .from('notification_queue')
        .update({ status: nextStatus, attempts, last_error: errorMsg, send_at: nextSendAt })
        .eq('id', item.id)

      await sb.from('notification_delivery_log').insert({
        queue_id: item.id,
        channel: 'email',
        template: item.type,
        recipient: 'unknown',
        status: 'failed',
        error: errorMsg,
        payload: item.payload,
      })

      continue
    }

    let reminderLang: 'en' | 'bg' = 'en'

    try {
      let html = ''

      if (item.type === 'event_reminder_1h' || item.type === 'event_reminder_15m') {
        const eventId = item.event_id
        if (!eventId) throw new Error('Missing event_id')

        const { data: event, error: eventErr } = await sb
          .from('calendar_events')
          .select('title, start_time, meeting_url')
          .eq('id', eventId)
          .single()

        if (eventErr || !event) throw new Error(eventErr ? eventErr.message : 'Event not found')

        const name = item.payload.name || 'Guest'

        // Guest's stored language preference (2607-DEV-589) + cancellation guard
        // (2607-DEV-590): a self-cancelled guest (or member — 2608-DEV-706)
        // must not get a reminder — the schedule trigger only fires on INSERT/
        // UPDATE OF status,email,name, so cancelling (which only touches
        // cancelled_at) does not clear the already-queued rows. Skip here
        // instead. Keyed by registration_id, not recipient email: member rows
        // have email NULL, so an email-keyed lookup silently never matched them
        // and a cancelled member kept receiving reminders (2608-DEV-706).
        if (item.registration_id) {
          const { data: guestReg } = await sb
            .from('guest_registrations')
            .select('lang, cancelled_at')
            .eq('id', item.registration_id)
            .maybeSingle()
          if (guestReg?.lang === 'bg') reminderLang = 'bg'
          if (guestReg?.cancelled_at != null) {
            await sb
              .from('notification_queue')
              .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null })
              .eq('id', item.id)
            continue
          }
        }

        const minutesBefore = item.type === 'event_reminder_1h' ? 60 : 15
        html = buildReminderEmail(name, event.title, minutesBefore, event.start_time, event.meeting_url, reminderLang)
      } else if (item.type === 'doc_expiry') {
        const profileId = item.profile_id
        if (!profileId) throw new Error('Missing profile_id')

        const { data: profile, error: profileErr } = await sb
          .from('profiles')
          .select('first_name, document_active_type, valid_through')
          .eq('id', profileId)
          .single()

        if (profileErr || !profile) throw new Error(profileErr ? profileErr.message : 'Profile not found')

        const expiryDate = new Date(profile.valid_through)
        const diffTime = expiryDate.getTime() - Date.now()
        const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
        const label = profile.document_active_type === 'passport' ? 'Passport' : 'National ID'

        html = buildHtmlEmail(profile.first_name || 'Member', label, daysRemaining, profile.valid_through)
      } else {
        throw new Error(`Unsupported notification type: ${item.type}`)
      }

      const subject = item.type === 'doc_expiry'
        ? 'Action Required: Your Travel Document expires soon'
        : (reminderLang === 'bg' ? 'Напомняне: Събитието започва скоро' : 'Reminder: Event starting soon')

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'TeamEnjoyVD <noreply@teamenjoyvd.com>',
          to: recipient,
          subject,
          html,
        }),
        signal: AbortSignal.timeout(15000),
      })

      const resendData = await res.json()
      if (!res.ok) {
        throw new Error(resendData.message || JSON.stringify(resendData))
      }
      resendId = resendData.id

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
        channel: 'email',
        template: item.type,
        recipient,
        status: 'sent',
        resend_id: resendId,
        payload: item.payload,
      })

      sentCount++
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : String(err)
      errors.push(`Email failed for item ${item.id}: ${errorMsg}`)

      const attempts = item.attempts || 1
      const maxAttempts = item.max_attempts || 3
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
        channel: 'email',
        template: item.type,
        recipient,
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
