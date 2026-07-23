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

/**
 * ICS all-day VEVENT date range: start = UTC-midnight Date of the Sofia
 * start day; end = UTC-midnight Date of the Sofia end day + 1 (VALUE=DATE
 * DTEND is exclusive per RFC 5545 §3.8.2.2, while the DB stores the
 * inclusive last day). Derived from date keys, so the stored Sofia-01:00
 * hour (drift from the sync function's historical +02:00 hardcode) is
 * irrelevant to the output.
 */
export function icsAllDayRange(startIso: string, endIso: string): { start: Date; end: Date } {
  const start = sofiaMidnightUtc(sofiaDateKey(startIso))
  const endKey = sofiaDateKey(endIso)
  // +1 calendar day via UTC date-string arithmetic, then re-resolve through
  // sofiaMidnightUtc — NOT +86400000ms on the instant, which under-shoots
  // on a DST fall-back day (25h long) and would leave `end` on the same
  // Sofia day as `endKey` instead of the next one.
  const nextDay = new Date(`${endKey}T00:00:00Z`)
  nextDay.setUTCDate(nextDay.getUTCDate() + 1)
  const end = sofiaMidnightUtc(nextDay.toISOString().slice(0, 10))
  return { start, end }
}
