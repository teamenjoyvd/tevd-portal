import { describe, expect, it } from 'vitest'
import {
  toGcalDate,
  buildGoogleCalUrl,
  buildOutlookUrl,
  buildIcsContent,
} from './calendar-links'

// These builders were moved verbatim out of JoinActions.tsx (2608-DEV-707).
// The point of this file is to pin the exact strings they produced there, so
// the move — and the second consumer (the member confirmation email) — cannot
// silently change a link a guest already has in their inbox.

const START = '2026-04-11T10:00:00.000Z'
const END = '2026-04-11T11:30:00.000Z'
const TITLE = 'N21 Weekly'
const MEETING_URL = 'https://meet.example.com/n21'

describe('toGcalDate', () => {
  it('strips millis, dashes and colons', () => {
    expect(toGcalDate(START)).toBe('20260411T100000Z')
  })

  it('is a no-op on an already-compact value', () => {
    expect(toGcalDate('20260411T100000Z')).toBe('20260411T100000Z')
  })

  it('handles an ISO string with no millis', () => {
    expect(toGcalDate('2026-04-11T10:00:00Z')).toBe('20260411T100000Z')
  })
})

describe('buildGoogleCalUrl', () => {
  it('sets action, text and the dates range', () => {
    const url = new URL(buildGoogleCalUrl(TITLE, START, END, null))
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(url.searchParams.get('action')).toBe('TEMPLATE')
    expect(url.searchParams.get('text')).toBe(TITLE)
    expect(url.searchParams.get('dates')).toBe('20260411T100000Z/20260411T113000Z')
  })

  it('adds location and details only when a location is given', () => {
    const withLocation = new URL(buildGoogleCalUrl(TITLE, START, END, MEETING_URL))
    expect(withLocation.searchParams.get('location')).toBe(MEETING_URL)
    expect(withLocation.searchParams.get('details')).toBe(`Join here: ${MEETING_URL}`)

    const without = new URL(buildGoogleCalUrl(TITLE, START, END, null))
    expect(without.searchParams.has('location')).toBe(false)
    expect(without.searchParams.has('details')).toBe(false)
  })
})

describe('buildOutlookUrl', () => {
  it('sets subject and the raw ISO start/end', () => {
    const url = new URL(buildOutlookUrl(TITLE, START, END, null))
    expect(url.origin + url.pathname).toBe('https://outlook.live.com/calendar/0/deeplink/compose')
    expect(url.searchParams.get('subject')).toBe(TITLE)
    // Outlook takes ISO, not the compact GCal form — the difference is load-bearing.
    expect(url.searchParams.get('startdt')).toBe(START)
    expect(url.searchParams.get('enddt')).toBe(END)
  })

  it('adds location and body only when a location is given', () => {
    const withLocation = new URL(buildOutlookUrl(TITLE, START, END, MEETING_URL))
    expect(withLocation.searchParams.get('location')).toBe(MEETING_URL)
    expect(withLocation.searchParams.get('body')).toBe(`Join here: ${MEETING_URL}`)

    const without = new URL(buildOutlookUrl(TITLE, START, END, null))
    expect(without.searchParams.has('location')).toBe(false)
    expect(without.searchParams.has('body')).toBe(false)
  })
})

describe('buildIcsContent', () => {
  it('emits CRLF-joined VCALENDAR lines with the location block', () => {
    expect(buildIcsContent(TITLE, START, END, MEETING_URL)).toBe(
      [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//TeamEnjoyVD//Portal//EN',
        'BEGIN:VEVENT',
        'DTSTART:20260411T100000Z',
        'DTEND:20260411T113000Z',
        `SUMMARY:${TITLE}`,
        `LOCATION:${MEETING_URL}`,
        `DESCRIPTION:Join here: ${MEETING_URL}`,
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n'),
    )
  })

  it('drops the LOCATION and DESCRIPTION lines when there is no location', () => {
    const ics = buildIcsContent(TITLE, START, END, null)
    expect(ics).not.toContain('LOCATION:')
    expect(ics).not.toContain('DESCRIPTION:')
    expect(ics.split('\r\n')).toHaveLength(9)
  })

  it('escapes backslashes, commas, semicolons and newlines in the summary', () => {
    const ics = buildIcsContent('A,B;C\\D\nE', START, END, null)
    expect(ics).toContain('SUMMARY:A\\,B\\;C\\\\D\\nE')
  })
})
