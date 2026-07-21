import { createHash } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { jwtVerify } from 'jose'
import ical from 'ical-generator'
import { listEventsForRole } from '@/lib/server/calendar'

const secret = new TextEncoder().encode(
  process.env.ICAL_TOKEN_SECRET ?? 'dev-ical-secret-change-in-production'
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')

  if (!token) {
    return new Response('Missing token', { status: 400 })
  }

  // Verify JWT — role is intentionally not extracted here; role is always resolved
  // live from the DB below to avoid stale-token promotion issues
  let payload: { profile_id: string }
  try {
    const { payload: p } = await jwtVerify(token, secret)
    payload = p as { profile_id: string }
  } catch {
    return new Response('Invalid or expired token', { status: 401 })
  }

  // Verify token matches stored token (allows revocation via regenerate)
  // Fetch role + ui_prefs live — role avoids stale JWT promotion issues,
  // ui_prefs provides the member's custom calendar display name.
  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('ical_token, role, ui_prefs')
    .eq('id', payload.profile_id)
    .single()

  if (!profile || profile.ical_token !== token) {
    return new Response('Token revoked', { status: 401 })
  }

  // Fetch events filtered by live profile role (not stale JWT role).
  // Falls back to an empty feed on a query error rather than surfacing a 500,
  // matching the prior inline query's behavior (errors were not checked there either).
  let events: Awaited<ReturnType<typeof listEventsForRole>> = []
  try {
    events = await listEventsForRole({ role: profile.role })
  } catch (err) {
    console.error('feed.ics: listEventsForRole failed', err)
  }

  // Use member's custom display name if set; fall back to default.
  // Note: calendar apps only read this name on first import — changing it
  // after subscription has no effect in Google Calendar et al.
  const calendarName =
    (profile.ui_prefs as Record<string, unknown> | null)?.ical_display_name as string | undefined
    ?? 'teamenjoyVD'

  // Build iCal — no timezone set so dates are emitted as UTC (DTSTART:...Z)
  // start_time/end_time from Supabase are +00 UTC strings; new Date() preserves that.
  const calendar = ical({
    name: calendarName,
    prodId: { company: 'teamenjoyVD', product: 'tevd-portal' },
  })

  for (const event of events ?? []) {
    // Google Calendar (Android) and iOS Calendar don't surface the structured
    // LOCATION/URL/CATEGORIES properties in their event view — append
    // human-readable lines to the description so the info is visible there too,
    // while keeping the structured properties for clients that do read them.
    const detailLines = [
      event.location ? `Location: ${event.location}` : undefined,
      event.meeting_url ? `Meeting link: ${event.meeting_url}` : undefined,
      event.category ? `Category: ${event.category}` : undefined,
    ].filter((line): line is string => line !== undefined)
    const description = [event.description ?? undefined, detailLines.length > 0 ? detailLines.join('\n') : undefined]
      .filter((part): part is string => part !== undefined)
      .join('\n\n')

    calendar.createEvent({
      id: event.id,
      summary: event.title,
      description: description || undefined,
      allDay: event.is_all_day,
      start: new Date(event.start_time),
      end: new Date(event.end_time),
      location: event.location ?? undefined,
      url: event.meeting_url ?? undefined,
      categories: event.category ? [{ name: event.category }] : undefined,
    })
  }

  const body = calendar.toString()
  // Weak ETag over the rendered feed — good enough for conditional GETs;
  // this is not a content hash used for integrity, just change detection.
  const etag = `W/"${createHash('sha1').update(body).digest('hex')}"`

  if (req.headers.get('if-none-match') === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Cache-Control': 'private, max-age=900',
      },
    })
  }

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="teamenjoyvd.ics"',
      'Cache-Control': 'private, max-age=900',
      ETag: etag,
    },
  })
}
