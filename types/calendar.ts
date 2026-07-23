// ── types/calendar.ts ────────────────────────────────────────────────────────────
// Shared domain types for calendar_events, derived from the generated Supabase schema.
import type { Database } from '@/types/supabase'

export type CalendarEventRow = Database['public']['Tables']['calendar_events']['Row']

/** Projection returned by listEventsForRole — matches member/agenda list consumers. */
export type CalendarListEvent = Pick<
  CalendarEventRow,
  | 'id'
  | 'title'
  | 'description'
  | 'start_time'
  | 'end_time'
  | 'category'
  | 'event_type'
  | 'week_number'
  | 'access_roles'
  | 'is_all_day'
  | 'location'
  | 'meeting_url'
>

/** Full row shape for single-event detail consumers. */
export type CalendarEventDetail = CalendarEventRow

/** Admin list row: full row plus the computed active-guest count attached by /api/admin/calendar. */
export type AdminCalendarEvent = CalendarEventRow & { guest_registration_count?: number }
