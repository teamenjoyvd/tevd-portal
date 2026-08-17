// ── app/(dashboard)/calendar/utils.ts ────────────────────────────────────
// Calendar-domain utilities and constants. Moved verbatim from
// CalendarClient.tsx — zero behaviour change.
//
// NOTE: formatTime here (en-GB, HH:mm, Sofia TZ) is intentionally distinct
// from lib/format.ts formatTime (bg-BG, 24h, Sofia TZ). Do not merge.

// ── Constants ─────────────────────────────────────────────────────────────

export const HOURS = Array.from({ length: 24 }, (_, i) => i)
export const HOUR_HEIGHT = 60

export const CATEGORY_COLOR: Record<string, { bg: string; text: string }> = {
  N21:      { bg: 'var(--brand-forest)',  text: 'rgba(var(--white-rgb), 0.95)' },
  Personal: { bg: 'var(--brand-sienna)', text: 'rgba(var(--white-rgb), 0.95)' },
}

// Moved to lib/calendar-dates.ts (shared with app/api/calendar/feed.ics) —
// re-exported here so existing importers are untouched.
export { SOFIA_DATE_FMT } from '@/lib/calendar-dates'
import { SOFIA_DATE_FMT } from '@/lib/calendar-dates'

// ── Helpers ───────────────────────────────────────────────────────────────

export function isoWeek(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const w1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d.getTime() - w1.getTime()) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7)
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

/** Compare two dates by their calendar day in Europe/Sofia TZ. */
export function sameDaySofia(a: Date, b: Date): boolean {
  return SOFIA_DATE_FMT.format(a) === SOFIA_DATE_FMT.format(b)
}

export function toMonthParam(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Format a UTC ISO string as HH:mm in Europe/Sofia. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Sofia',
  })
}

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Sofia',
  })
}

export function eventMinutesFromMidnight(iso: string): number {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

export function eventDurationMinutes(start: string, end: string): number {
  return Math.max(30, (new Date(end).getTime() - new Date(start).getTime()) / 60000)
}
