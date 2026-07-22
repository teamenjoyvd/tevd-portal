import { createHash } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/service'
import ical from 'ical-generator'
import { listEventsForRole } from '@/lib/server/calendar'
import { verifyIcalToken, IcalTokenConfigError } from '@/lib/server/icalToken'

const FEED_WINDOW_PAST_DAYS = 90
const FEED_WINDOW_FUTURE_DAYS = 365
const FEED_LIMIT = 500

function toUtcDateOnly(isoString: string): Date {
  const d = new Date(isoString)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

// RFC 7232 §3.2: If-None-Match may carry a comma-separated list of ETags, or
// `*`. A plain `===` against the raw header would never match either form.
function matchesIfNoneMatch(header: string | null, etag: string): boolean {
  if (!header) return false
  if (header.trim() === '*') return true
  return header.split(',').map((t) => t.trim()).includes(etag)
}

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
    payload = await verifyIcalToken(token)
  } catch (err) {
    if (err instanceof IcalTokenConfigError) {
      return new Response('Calendar service unavailable', { status: 503 })
    }
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
    const now = Date.now()
    const from = new Date(now - FEED_WINDOW_PAST_DAYS * 86400000).toISOString()
    const to = new Date(now + FEED_WINDOW_FUTURE_DAYS * 86400000).toISOString()
    events = await listEventsForRole({ role: profile.role, from, to, limit: FEED_LIMIT })
  } catch (err) {
    console.error('feed.ics: listEventsForRole failed', err)
  }

  // Use member's custom display name if set; fall back to default.
  // Note: calendar apps only read this name on first import — changing it
  // after subscription has no effect in Google Calendar et al.
  const calendarName =
    (profile.ui_prefs as Record<string, unknown> | null)?.ical_display_name as string | undefined
    ?? 'teamenjoyVD'

  // Weak ETag over the source event data, NOT calendar.toString() — ical-generator
  // stamps every VEVENT with DTSTAMP:<render time>, so hashing the rendered body
  // would change the ETag on every request even when the underlying data hasn't,
  // permanently defeating If-None-Match. Computed before building/serializing the
  // calendar so a conditional-GET hit short-circuits that work entirely.
  const etag = `W/"${createHash('sha1').update(JSON.stringify(events ?? []) + calendarName).digest('hex')}"`

  if (matchesIfNoneMatch(req.headers.get('if-none-match'), etag)) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Cache-Control': 'private, max-age=900',
      },
    })
  }

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
      event.location != null && event.location !== '' ? `Location: ${event.location}` : undefined,
      event.meeting_url != null && event.meeting_url !== '' ? `Meeting link: ${event.meeting_url}` : undefined,
      event.category != null ? `Category: ${event.category}` : undefined,
    ].filter((line): line is string => line !== undefined)
    const baseDescription = event.description != null && event.description !== '' ? event.description : undefined
    const description = [baseDescription, detailLines.length > 0 ? detailLines.join('\n') : undefined]
      .filter((part): part is string => part !== undefined)
      .join('\n\n')

    // For all-day events, ical-generator's VALUE=DATE truncates the Date to its
    // UTC date component — normalize to the UTC midnight boundary here so a
    // stored start_time/end_time that isn't exactly UTC midnight (e.g. legacy
    // data) can't shift the displayed calendar day.
    const start = event.is_all_day ? toUtcDateOnly(event.start_time) : new Date(event.start_time)
    const end = event.is_all_day ? toUtcDateOnly(event.end_time) : new Date(event.end_time)

    calendar.createEvent({
      id: event.id,
      summary: event.title,
      description: description || undefined,
      allDay: event.is_all_day,
      start,
      end,
      location: event.location != null && event.location !== '' ? event.location : undefined,
      url: event.meeting_url != null && event.meeting_url !== '' ? event.meeting_url : undefined,
      categories: event.category != null ? [{ name: event.category }] : undefined,
    })
  }

  return new Response(calendar.toString(), {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="teamenjoyvd.ics"',
      'Cache-Control': 'private, max-age=900',
      ETag: etag,
    },
  })
}
