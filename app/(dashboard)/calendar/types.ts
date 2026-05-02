// ── app/(dashboard)/calendar/types.ts ────────────────────────────────────
// Shared domain types for the calendar feature.
// Promoted from CalendarClient.tsx to break the import cycle introduced
// by the useCalendar hook (useCalendar + CalendarClient both need this type).

export type CalendarEvent = {
  id: string
  title: string
  description: string | null
  start_time: string
  end_time: string
  category: 'N21' | 'Personal'
  event_type: 'in-person' | 'online' | 'hybrid' | null
  week_number: number
  access_roles: string[]
}

export type View = 'month' | 'agenda'
