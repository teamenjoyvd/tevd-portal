// ── lib/calendar-links.ts ─────────────────────────────────────────────────
// Add-to-calendar link builders. Moved verbatim out of
// app/events/[eventId]/join/components/JoinActions.tsx (2608-DEV-707) so the
// member confirmation email can build the same Google/Outlook links
// server-side that the join page builds in the browser.
//
// Pure string builders, no React and no browser API — importable from a
// server action, a route handler and a client component alike.

/** Convert ISO datetime string -> compact UTC GCal format: 20260411T100000Z */
export function toGcalDate(iso: string): string {
  // Already compact — passed straight through, as the JoinActions version did.
  if (/^\d{8}T\d{6}Z$/.test(iso)) return iso
  // A plain strip of dashes/colons turns an offset value — which is exactly what
  // PostgREST returns for timestamptz, `2026-04-11T13:00:00+03:00` — into
  // `20260411T130000+0300`: neither the UTC instant nor a form Google Calendar
  // and ICS accept. Convert to the UTC instant first (2608-DEV-707 review).
  return new Date(iso).toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[-:]/g, '')
}

/** Empty location strings are absent locations, not falsy ones. */
function normalizeLocation(location: string | null): string | null {
  return location === '' ? null : location
}

export function buildGoogleCalUrl(
  title: string,
  start: string,
  end: string,
  location: string | null,
): string {
  const url = new URL('https://calendar.google.com/calendar/render')
  url.searchParams.set('action', 'TEMPLATE')
  url.searchParams.set('text', title)
  url.searchParams.set('dates', `${toGcalDate(start)}/${toGcalDate(end)}`)
  const loc = normalizeLocation(location)
  if (loc !== null) {
    url.searchParams.set('location', loc)
    url.searchParams.set('details', `Join here: ${loc}`)
  }
  return url.toString()
}

export function buildOutlookUrl(
  title: string,
  start: string,
  end: string,
  location: string | null,
): string {
  const url = new URL('https://outlook.live.com/calendar/0/deeplink/compose')
  url.searchParams.set('subject', title)
  url.searchParams.set('startdt', start)
  url.searchParams.set('enddt', end)
  const loc = normalizeLocation(location)
  if (loc !== null) {
    url.searchParams.set('location', loc)
    url.searchParams.set('body', `Join here: ${loc}`)
  }
  return url.toString()
}

export function buildIcsContent(
  title: string,
  start: string,
  end: string,
  location: string | null,
): string {
  const escape = (str: string) => str.replace(/[\\,;]/g, '\\$&').replace(/\r?\n/g, '\\n')
  const loc = normalizeLocation(location)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TeamEnjoyVD//Portal//EN',
    'BEGIN:VEVENT',
    `DTSTART:${toGcalDate(start)}`,
    `DTEND:${toGcalDate(end)}`,
    `SUMMARY:${escape(title)}`,
    loc !== null ? `LOCATION:${escape(loc)}` : null,
    loc !== null ? `DESCRIPTION:Join here: ${escape(loc)}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter((l): l is string => l !== null)
  return lines.join('\r\n')
}
