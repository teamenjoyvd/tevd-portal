// ── lib/calendar-dates.ts ────────────────────────────────────────────────
// Sofia-timezone date-key helpers shared by server routes (feed.ics) and
// client components (calendar rendering). No `server-only`, no DB imports.
import { TZ } from '@/lib/format'

const MAX_SPAN_DAYS = 366

/** Sofia date formatter (YYYY-MM-DD via sv-SE). Used for day-key comparisons. */
export const SOFIA_DATE_FMT = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

// Full wall-clock formatter (date + time) needed to measure the Sofia UTC
// offset by round-trip — SOFIA_DATE_FMT alone loses the hour, which is the
// entire quantity being measured.
const SOFIA_DATETIME_FMT = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

/** 'YYYY-MM-DD' of the Sofia calendar day for a UTC ISO instant. */
export function sofiaDateKey(iso: string): string {
  return SOFIA_DATE_FMT.format(new Date(iso))
}

/**
 * DST-correct UTC instant of Sofia 00:00 for a 'YYYY-MM-DD' date key.
 * Measures the offset by round-tripping through Intl, mirroring the
 * approach in lib/format.ts fromSofiaLocalInput.
 */
export function sofiaMidnightUtc(dateKey: string): Date {
  const naiveDate = new Date(`${dateKey}T00:00:00Z`)
  const sofiaWall = SOFIA_DATETIME_FMT.format(naiveDate).replace(' ', 'T')
  const sofiaAsUtc = new Date(`${sofiaWall}Z`)
  const offsetMs = naiveDate.getTime() - sofiaAsUtc.getTime()
  return new Date(naiveDate.getTime() + offsetMs)
}

/**
 * Inclusive list of 'YYYY-MM-DD' Sofia date keys covered by [startIso, endIso].
 * Iterates on the date-key string, never the instant, so DST cannot add or
 * drop a day. Returns [startKey] when end < start; clamps at MAX_SPAN_DAYS
 * so a corrupt end_time can't hang a render loop.
 */
export function sofiaDateKeysBetween(startIso: string, endIso: string): string[] {
  const startKey = sofiaDateKey(startIso)
  const endKey = sofiaDateKey(endIso)
  if (endKey <= startKey) return [startKey]

  // Walk the 'YYYY-MM-DD' string via UTC calendar-date arithmetic — never
  // via a fixed-duration instant step. A DST-transition day is 23h or 25h
  // long, so stepping an instant by exactly 86400000ms can land on the same
  // Sofia calendar day twice (fall-back) or skip one (spring-forward).
  const keys: string[] = [startKey]
  let cursor = new Date(`${startKey}T00:00:00Z`)
  for (let i = 0; i < MAX_SPAN_DAYS && keys[keys.length - 1] < endKey; i++) {
    cursor = new Date(cursor.getTime() + 86400000)
    keys.push(cursor.toISOString().slice(0, 10))
  }
  return keys
}

/** 'YYYY-MM' of the month following a 'YYYY-MM' month key, rolling the year over at December. */
export function nextMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`
}

/** 'YYYY-MM' of the month preceding a 'YYYY-MM' month key, rolling the year back at January. */
export function prevMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  return `${prevYear}-${String(prevMonth).padStart(2, '0')}`
}

/**
 * Noon UTC on the 1st of a 'YYYY-MM' month key — keeps the same calendar day
 * for Sofia and for any runtime timezone within the realistic range of
 * users/servers this app runs in, so local getters (getFullYear/getMonth)
 * agree with the Sofia month without needing a Sofia-aware read everywhere.
 */
export function monthKeyToDate(monthKey: string): Date {
  return new Date(`${monthKey}-01T12:00:00Z`)
}

/**
 * ICS all-day VEVENT date range: start = a Date whose UTC Y/M/D equal the
 * Sofia start day; end = a Date whose UTC Y/M/D equal the Sofia end day + 1
 * (VALUE=DATE DTEND is exclusive per RFC 5545 §3.8.2.2, while the DB stores
 * the inclusive last day).
 *
 * Deliberately NOT sofiaMidnightUtc: ical-generator serializes an allDay
 * event's Date via its UTC getters when the calendar has no timezone set
 * (our feed.ics case) — verified against ical-generator's source (the `l()`
 * date formatter falls back to getUTCFullYear/getUTCMonth/getUTCDate). A
 * real Sofia-midnight instant like sofiaMidnightUtc('2026-10-23') is
 * 2026-10-22T21:00:00Z, whose UTC date is Oct 22 — one day early. The value
 * ical-generator needs is a Date whose UTC fields literally spell out the
 * target Sofia date, not a real instant at all.
 */
export function icsAllDayRange(startIso: string, endIso: string): { start: Date; end: Date } {
  const start = new Date(`${sofiaDateKey(startIso)}T00:00:00Z`)
  const end = new Date(`${sofiaDateKey(endIso)}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 1)
  return { start, end }
}
