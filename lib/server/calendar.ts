// ── lib/server/calendar.ts ───────────────────────────────────────────────────────
// Single source of truth for role-scoped calendar_events queries.
// Used by: /api/calendar, /api/calendar/feed.ics, app/(dashboard)/calendar/page.tsx (RSC).
// Server-only — never import from client components.
import { createServiceClient } from '@/lib/supabase/service'
import type { CalendarListEvent } from '@/types/calendar'

const LIST_COLUMNS =
  'id, title, description, start_time, end_time, category, event_type, week_number, access_roles, is_all_day, location, meeting_url'

/**
 * Role-scoped calendar events, ordered by start_time.
 * `from`/`to` bound the window when provided; omit either for an unbounded query (e.g. feed.ics).
 */
export async function listEventsForRole({
  role,
  from,
  to,
  limit = 500,
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
    .limit(limit)

  if (from) query = query.gte('start_time', from)
  if (to) query = query.lt('start_time', to)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  if (data && data.length === limit) {
    console.warn(`listEventsForRole: hit limit (${limit}) for role "${role}" — results may be truncated`)
  }
  return (data ?? []) as CalendarListEvent[]
}
