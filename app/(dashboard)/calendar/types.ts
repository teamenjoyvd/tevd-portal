// ── app/(dashboard)/calendar/types.ts ────────────────────────────────────
// Shared domain types for the calendar feature.
// Promoted from CalendarClient.tsx to break the import cycle introduced
// by the useCalendar hook (useCalendar + CalendarClient both need this type).
import type { CalendarListEvent } from '@/types/calendar'

export type CalendarEvent = CalendarListEvent

export type View = 'month' | 'agenda'
