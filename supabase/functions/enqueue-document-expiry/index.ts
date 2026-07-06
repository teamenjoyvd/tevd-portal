import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req: Request) => {
  const secret = Deno.env.get('SYNC_SECRET')
  if (!secret || req.headers.get('x-sync-secret') !== secret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Missing environment variables' }), { status: 500 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const now = new Date()

  // Find all profiles whose valid_through is between today and today + 60 days
  const todayStr = now.toISOString().split('T')[0]
  const sixtyDaysLater = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
  const sixtyDaysLaterStr = sixtyDaysLater.toISOString().split('T')[0]

  const { data: profiles, error: profileErr } = await supabase
    .from('profiles')
    .select('id, first_name, document_active_type, valid_through, contact_email')
    .not('valid_through', 'is', null)
    .gte('valid_through', todayStr)
    .lte('valid_through', sixtyDaysLaterStr)

  if (profileErr) {
    return new Response(
      JSON.stringify({ error: 'Database error', detail: profileErr.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (!profiles || profiles.length === 0) {
    return new Response(
      JSON.stringify({ message: 'No expiring documents found', processed: 0 }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  const enqueued: any[] = []
  const skipped: any[] = []

  for (const profile of profiles) {
    // Check if a warning notification of type 'doc_expiry' was enqueued in the last 60 days
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
    const { data: existing, error: existErr } = await supabase
      .from('notification_queue')
      .select('id')
      .eq('profile_id', profile.id)
      .eq('type', 'doc_expiry')
      .gte('created_at', sixtyDaysAgo)
      .limit(1)

    if (existErr) {
      skipped.push({ profile_id: profile.id, reason: `Error checking existing: ${existErr.message}` })
      continue
    }

    if (existing && existing.length > 0) {
      skipped.push({ profile_id: profile.id, reason: 'Already enqueued in the last 60 days' })
      continue
    }

    // Fetch user preferences
    const { data: pref, error: prefErr } = await supabase
      .from('notification_preferences')
      .select('email_enabled, in_app_enabled')
      .eq('profile_id', profile.id)
      .maybeSingle()

    if (prefErr) {
      skipped.push({ profile_id: profile.id, reason: `Error fetching preferences: ${prefErr.message}` })
      continue
    }

    const emailEnabled = pref ? pref.email_enabled !== false : true
    const inAppEnabled = pref ? pref.in_app_enabled !== false : true
    const label = profile.document_active_type === 'passport' ? 'Passport' : 'National ID'

    const payload = {
      document_id: profile.id,
      document_name: label,
      title: 'Document Expiring Soon',
      body: 'Your ' + label + ' expires on ' + profile.valid_through + '. Please update it.',
      email: profile.contact_email
    }

    let enqueuedEmail = false
    let enqueuedInApp = false

    // Email channel
    if (emailEnabled && profile.contact_email) {
      const { error: insErr } = await supabase
        .from('notification_queue')
        .insert({
          profile_id: profile.id,
          type: 'doc_expiry',
          channel: 'email',
          status: 'pending',
          payload: payload,
          send_at: new Date().toISOString(),
          attempts: 0,
          max_attempts: 3
        })

      if (insErr) {
        skipped.push({ profile_id: profile.id, reason: `Failed to insert email queue: ${insErr.message}` })
      } else {
        enqueuedEmail = true
      }
    }

    // In App channel
    if (inAppEnabled) {
      const { error: insErr } = await supabase
        .from('notification_queue')
        .insert({
          profile_id: profile.id,
          type: 'doc_expiry',
          channel: 'in_app',
          status: 'pending',
          payload: payload,
          send_at: new Date().toISOString(),
          attempts: 0,
          max_attempts: 5
        })

      if (insErr) {
        skipped.push({ profile_id: profile.id, reason: `Failed to insert in_app queue: ${insErr.message}` })
      } else {
        enqueuedInApp = true
      }
    }

    if (enqueuedEmail || enqueuedInApp) {
      enqueued.push({
        profile_id: profile.id,
        email: enqueuedEmail,
        in_app: enqueuedInApp
      })
    }
  }

  return new Response(
    JSON.stringify({ processed: profiles.length, enqueued, skipped }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
