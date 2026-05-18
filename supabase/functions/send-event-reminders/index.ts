import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function buildReminderEmail(name: string, eventTitle: string, minutesBefore: number, eventStart: string, meetingUrl: string | null) {
  const label = minutesBefore >= 60 ? '1 hour' : '15 minutes'
  const formattedTime = new Date(eventStart).toLocaleString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Sofia',
  })

  const safeName = escapeHtml(name)
  const safeEventTitle = escapeHtml(eventTitle)
  const safeFormattedTime = escapeHtml(formattedTime)
  const safeMeetingUrl = meetingUrl ? escapeHtml(meetingUrl) : null

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Event Reminder</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 40px 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; }
        .header { background-color: #111827; padding: 24px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 600; }
        .content { padding: 32px; }
        .text { margin: 0 0 16px; font-size: 15px; color: #374151; line-height: 24px; }
        .badge { background-color: #bc474918; border: 1px solid #bc474944; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
        .badge-text { margin: 0; font-weight: 700; color: #bc4749; font-size: 15px; }
        .btn { display: inline-block; background-color: #bc4749; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; }
        .footer { padding: 20px; text-align: center; font-size: 13px; color: #6b7280; border-top: 1px solid #f3f4f6; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Event Reminder</h1>
        </div>
        <div class="content">
          <p class="text" style="color: #111827;">Hi ${safeName},</p>
          <p class="text">This is a reminder that your event is starting in <strong>${label}</strong>.</p>
          <div class="badge">
            <p class="badge-text">${safeEventTitle}</p>
            <p style="margin: 4px 0 0; font-size: 13px; color: #6b7280;">${safeFormattedTime}</p>
          </div>
          ${safeMeetingUrl ? `<p class="text" style="text-align:center;"><a href="${safeMeetingUrl}" class="btn">Join Event</a></p>` : ''}
          <p class="text" style="font-size: 14px; color: #6b7280;">See you there!</p>
        </div>
        <div class="footer">&copy; ${new Date().getFullYear()} TeamEnjoyVD</div>
      </div>
    </body>
    </html>
  `
}

Deno.serve(async (req: Request) => {
  const secret = Deno.env.get('SYNC_SECRET')
  if (secret && req.headers.get('x-sync-secret') !== secret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'Missing RESEND_API_KEY' }), { status: 500 })
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const now = new Date()

  // Read global reminder toggles — one query before the main fetch
  const { data: settingsRows } = await sb
    .from('settings')
    .select('key, value')
    .in('key', ['reminders_1hr_enabled', 'reminders_15min_enabled'])

  const settingsMap = Object.fromEntries((settingsRows ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]))
  const globalToggles = {
    '1_hour': settingsMap['reminders_1hr_enabled'] !== 'false',
    '15_min': settingsMap['reminders_15min_enabled'] !== 'false',
  }

  // Fetch unsent reminders due now (send_at <= now).
  // FK hint must use constraint name, not column name — PostgREST requires this
  // for joins from the child table side.
  // Constraints: scheduled_reminders_event_id_fkey, scheduled_reminders_registration_id_fkey
  // guest_registrations.name is the registrant's name field (not first_name).
  const { data: reminders, error: fetchErr } = await sb
    .from('scheduled_reminders')
    .select(`
      id,
      reminder_type,
      send_at,
      event_id,
      registration_id,
      calendar_events!scheduled_reminders_event_id_fkey ( title, start_time, meeting_url, reminders_enabled ),
      guest_registrations!scheduled_reminders_registration_id_fkey ( name, email )
    `)
    .is('sent_at', null)
    .lte('send_at', now.toISOString())

  if (fetchErr) {
    return new Response(JSON.stringify({ error: 'DB error', detail: fetchErr.message }), { status: 500 })
  }

  if (!reminders || reminders.length === 0) {
    return new Response(JSON.stringify({ message: 'No reminders due' }), { headers: { 'Content-Type': 'application/json' } })
  }

  let sentCount = 0
  const errors: string[] = []

  for (const reminder of reminders) {
    const event = reminder.calendar_events as { title: string; start_time: string; meeting_url: string | null; reminders_enabled: boolean } | null
    const reg = reminder.guest_registrations as { name: string; email: string } | null

    if (!event || !reg?.email) {
      errors.push(`Missing event/registration data for reminder ${reminder.id}`)
      continue
    }

    // Global type toggle — skip silently, do not delete the row
    if (!globalToggles[reminder.reminder_type as '1_hour' | '15_min']) {
      continue
    }

    // Per-event toggle — skip silently, do not delete the row
    if (event.reminders_enabled === false) {
      continue
    }

    const minutesBefore = reminder.reminder_type === '1_hour' ? 60 : 15
    const html = buildReminderEmail(reg.name, event.title, minutesBefore, event.start_time, event.meeting_url)
    const label = minutesBefore >= 60 ? '1 hour' : '15 minutes'

    let status = 'pending'
    let resendId: string | null = null
    let errorMsg: string | null = null

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'TeamEnjoyVD <noreply@teamenjoyvd.com>',
          to: reg.email,
          subject: `Reminder: ${event.title} starts in ${label}`,
          html,
        }),
      })

      const resendData = await res.json()
      if (!res.ok) throw new Error(resendData.message || JSON.stringify(resendData))
      resendId = resendData.id
      status = 'sent'
      sentCount++
    } catch (err) {
      status = 'failed'
      errorMsg = err instanceof Error ? err.message : String(err)
      errors.push(`Email failed for reminder ${reminder.id}: ${errorMsg}`)
    }

    // Only mark sent_at when email actually succeeded
    if (status === 'sent') {
      await sb
        .from('scheduled_reminders')
        .update({ sent_at: new Date().toISOString() })
        .eq('id', reminder.id)
    }

    // Log to email_log
    await sb.from('email_log').insert({
      template: 'event_reminder',
      recipient: reg.email,
      payload: { reminder_id: reminder.id, event_id: reminder.event_id, reminder_type: reminder.reminder_type },
      status,
      resend_id: resendId,
      error: errorMsg,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    })
  }

  return new Response(
    JSON.stringify({ sent_count: sentCount, total: reminders.length, errors }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
