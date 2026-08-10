// ── lib/calendar-links.ts ─────────────────────────────────────────────────
// Add-to-calendar link builders. Moved verbatim out of
// app/events/[eventId]/join/components/JoinActions.tsx (2608-DEV-707) so the
// member confirmation email can build the same Google/Outlook links
// server-side that the join page builds in the browser.
//
// Pure string builders, no React and no browser API — importable from a
// server action, a route handler and a client component alike.

/** Convert ISO datetime string -> compact GCal format: 20260411T100000Z */
export function toGcalDate(iso: string): string {
  return iso.replace(/\.\d+/, '').replace(/[-:]/g, '')
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
  if (location) {
    url.searchParams.set('location', location)
    url.searchParams.set('details', `Join here: ${location}`)
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
  if (location) {
    url.searchParams.set('location', location)
    url.searchParams.set('body', `Join here: ${location}`)
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
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TeamEnjoyVD//Portal//EN',
    'BEGIN:VEVENT',
    `DTSTART:${toGcalDate(start)}`,
    `DTEND:${toGcalDate(end)}`,
    `SUMMARY:${escape(title)}`,
    location ? `LOCATION:${escape(location)}` : null,
    location ? `DESCRIPTION:Join here: ${escape(location)}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter((l): l is string => l !== null)
  return lines.join('\r\n')
}
