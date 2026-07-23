// ── lib/server/calendar.ts ───────────────────────────────────────────────────────
// Single source of truth for role-scoped calendar_events queries.
// Used by: /api/calendar, /api/calendar/feed.ics, app/(dashboard)/calendar/page.tsx (RSC).
// Server-only — never import from client components.
import { createServiceClient } from '@/lib/supabase/service'
import type { CalendarListEvent } from '@/types/calendar'
import { icsAllDayRange } from '@/lib/calendar-dates'
import type { ICalEventData } from 'ical-generator'

const LIST_COLUMNS =
  'id, title, description, start_time, end_time, category, event_type, week_number, access_roles, is_all_day, location, meeting_url'

/**
 * Composes the ICS VEVENT description: the event's own description plus
 * human-readable Location/Meeting link/Category lines. Google Calendar
 * (Android) and iOS Calendar don't surface the structured LOCATION/URL/
 * CATEGORIES properties in their event view, so this appends the same info
 * as plain text — kept alongside the structured properties for clients that
 * do read them. Extracted from feed.ics/route.ts so the composed format can
 * be snapshot-tested without mocking auth/DB (Phase 1c format, #597).
 */
export function buildEventDescription(event: {
  description: string | null
  location: string | null
  meeting_url: string | null
  category: string | null
}): string | undefined {
  const detailLines = [
    event.location != null && event.location !== '' ? `Location: ${event.location}` : undefined,
    event.meeting_url != null && event.meeting_url !== '' ? `Meeting link: ${event.meeting_url}` : undefined,
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
export function toVEventInput(event: {
  id: string
  title: string
  description: string | null
  location: string | null
  meeting_url: string | null
  category: string | null
  is_all_day: boolean
  start_time: string
  end_time: string
}): ICalEventData {
  const description = buildEventDescription(event)
  const { start, end } = event.is_all_day
    ? icsAllDayRange(event.start_time, event.end_time)
    : { start: new Date(event.start_time), end: new Date(event.end_time) }

  return {
    id: event.id,
    summary: event.title,
    description: description || undefined,
    allDay: event.is_all_day,
    start,
    end,
    location: event.location != null && event.location !== '' ? event.location : undefined,
    url: event.meeting_url != null && event.meeting_url !== '' ? event.meeting_url : undefined,
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
  if (to) query = query.lt('start_time', to)
  if (from) query = query.gte('end_time', from)
  if (limit) query = query.limit(limit)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  if (limit && data && data.length === limit) {
    console.warn(`listEventsForRole: hit limit (${limit}) for role "${role}" — results may be truncated`)
  }
  return (data ?? []) as CalendarListEvent[]
}
