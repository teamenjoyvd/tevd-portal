// ── lib/server/calendar.ts ───────────────────────────────────────────────────────
// Single source of truth for role-scoped calendar_events queries.
// Used by: /api/calendar, /api/calendar/feed.ics, app/(dashboard)/calendar/page.tsx (RSC).
// Server-only — never import from client components.
import { createServiceClient } from '@/lib/supabase/service'
import type { CalendarListEvent } from '@/types/calendar'
import { icsAllDayRange } from '@/lib/calendar-dates'
import type { ICalEventData } from 'ical-generator'

// meeting_url is deliberately absent (2608-DEV-703, epic #702 decision D8).
// /api/calendar is on the public allowlist and resolves sessionless callers to
// role 'guest', so anything selected here reaches anonymous visitors. The link
// is served only by the gated detail endpoint, app/api/events/[id]/route.ts.
const LIST_COLUMNS =
  'id, title, description, start_time, end_time, category, event_type, week_number, access_roles, is_all_day, location'

/** Deep link to a single event in the portal calendar (app/(dashboard)/calendar/page.tsx reads ?event=). */
function portalEventUrl(portalUrl: string, eventId: string): string {
  return `${portalUrl}/calendar?event=${encodeURIComponent(eventId)}`
}

/**
 * Composes the ICS VEVENT description: the event's own description plus
 * human-readable Location/Details/Category lines. Google Calendar
 * (Android) and iOS Calendar don't surface the structured LOCATION/URL/
 * CATEGORIES properties in their event view, so this appends the same info
 * as plain text — kept alongside the structured properties for clients that
 * do read them. Extracted from feed.ics/route.ts so the composed format can
 * be snapshot-tested without mocking auth/DB (Phase 1c format, #597).
 *
 * `portalUrl` is passed in rather than resolved here: getBaseUrl() is async and
 * throws on a missing NEXT_PUBLIC_APP_URL, which would make this function async
 * and drag auth/env mocking into its snapshot tests. The caller owns that.
 */
export function buildEventDescription(
  event: {
    id: string
    description: string | null
    location: string | null
    category: string | null
  },
  portalUrl: string,
): string | undefined {
  const detailLines = [
    event.location != null && event.location !== '' ? `Location: ${event.location}` : undefined,
    `Details: ${portalEventUrl(portalUrl, event.id)}`,
    event.category != null && event.category !== '' ? `Category: ${event.category}` : undefined,
  ].filter((line): line is string => line !== undefined)
  const baseDescription = event.description != null && event.description !== '' ? event.description : undefined
  const description = [baseDescription, detailLines.length > 0 ? detailLines.join('\n') : undefined]
    .filter((part): part is string => part !== undefined)
    .join('\n\n')
  return description || undefined
}

/**
 * Builds the ical-generator input for a single VEVENT. Pure function —
 * extracted from feed.ics/route.ts so ICS date output can be snapshot-tested
 * without mocking auth/DB (the route itself needs Clerk + Supabase).
 *
 * All-day events use icsAllDayRange (Sofia date-key derived, DTEND exclusive
 * per RFC 5545 §3.8.2.2); timed events pass start_time/end_time straight
 * through — they're already +00 UTC strings from Supabase.
 */
export function toVEventInput(
  event: {
    id: string
    title: string
    description: string | null
    location: string | null
    category: string | null
    is_all_day: boolean
    start_time: string
    end_time: string
  },
  portalUrl: string,
): ICalEventData {
  const description = buildEventDescription(event, portalUrl)
  const { start, end } = event.is_all_day
    ? icsAllDayRange(event.start_time, event.end_time)
    : { start: new Date(event.start_time), end: new Date(event.end_time) }

  return {
    id: event.id,
    summary: event.title,
    description,
    allDay: event.is_all_day,
    start,
    end,
    location: event.location != null && event.location !== '' ? event.location : undefined,
    // Points at the portal, never the meeting link (D8) — a single feed
    // subscription would otherwise hand out every link for a year.
    url: portalEventUrl(portalUrl, event.id),
    categories: event.category != null ? [{ name: event.category }] : undefined,
  }
}

/**
 * Role-scoped calendar events, ordered by start_time.
 * `from`/`to` bound the window when provided.
 * `limit` is only applied when explicitly passed — with ascending start_time
 * order, an implicit default here would silently keep the OLDEST rows and
 * drop future events once a role's total row count exceeds it. Callers with
 * no natural window (e.g. feed.ics) must stay unbounded; callers with a
 * from/to window (agenda, admin) are already bounded by that window.
 */
export async function listEventsForRole({
  role,
  from,
  to,
  limit,
}: {
  role: string
  from?: string
  to?: string
  limit?: number
}): Promise<CalendarListEvent[]> {
  const supabase = createServiceClient()
  let query = supabase
    .from('calendar_events')
    .select(LIST_COLUMNS)
    .contains('access_roles', [role])
    .order('start_time')

  // Overlap semantics, not start-only: an event starting before `from` but
  // still running (end_time >= from) must still match, or a multi-day span
  // straddling a window boundary silently disappears from that window.
  if (to !== undefined) query = query.lt('start_time', to)
  if (from !== undefined) query = query.gte('end_time', from)
  if (limit !== undefined) query = query.limit(limit)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  if (limit !== undefined && data && data.length === limit) {
    console.warn(`listEventsForRole: hit limit (${limit}) for role "${role}" — results may be truncated`)
  }
  return (data ?? []) as CalendarListEvent[]
}
