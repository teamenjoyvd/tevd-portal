import { describe, expect, it } from 'vitest'
import { sofiaDateKey, sofiaDateKeysBetween, sofiaMidnightUtc, icsAllDayRange } from '@/lib/calendar-dates'

describe('sofiaDateKeysBetween', () => {
  it('yields the correct 3-day span for the real prod October row', () => {
    expect(sofiaDateKeysBetween('2026-10-22T22:00:00Z', '2026-10-24T22:00:00Z')).toEqual([
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ])
  })

  it('yields a 3-key span for the June prod row starting 2026-06-12', () => {
    const keys = sofiaDateKeysBetween('2026-06-11T22:00:00Z', '2026-06-13T22:00:00Z')
    expect(keys).toHaveLength(3)
    expect(keys[0]).toBe('2026-06-12')
  })

  it('handles DST fall-back (25 Oct 2026)', () => {
    // Sofia falls back to EET (+02:00) at 2026-10-25 04:00 local; start is
    // pre-fallback EEST (Sofia 00:00), end is post-fallback EET (Sofia 23:00).
    const keys = sofiaDateKeysBetween('2026-10-24T21:00:00Z', '2026-10-26T21:00:00Z')
    expect(keys).toEqual(['2026-10-25', '2026-10-26'])
  })

  it('handles DST spring-forward (29 Mar 2026)', () => {
    // Sofia springs forward to EEST (+03:00) at 2026-03-29 03:00 local.
    const keys = sofiaDateKeysBetween('2026-03-28T22:00:00Z', '2026-03-30T21:00:00Z')
    expect(keys).toEqual(['2026-03-29', '2026-03-30', '2026-03-31'])
  })

  it('is insensitive to the stored hour — Sofia 01:00 and Sofia 00:00 give the same day key', () => {
    const a = sofiaDateKeysBetween('2026-10-22T22:00:00Z', '2026-10-22T22:00:00Z') // Sofia 01:00
    const b = sofiaDateKeysBetween('2026-10-22T21:00:00Z', '2026-10-22T21:00:00Z') // Sofia 00:00
    expect(a).toEqual(b)
  })

  it('yields 2 keys for a timed event spanning midnight (Fri 20:00 -> Sat 02:00)', () => {
    const keys = sofiaDateKeysBetween('2026-06-19T17:00:00Z', '2026-06-19T23:00:00Z')
    expect(keys).toHaveLength(2)
  })

  it('returns [startKey] when end < start', () => {
    expect(sofiaDateKeysBetween('2026-06-15T00:00:00Z', '2026-06-10T00:00:00Z')).toEqual(['2026-06-15'])
  })
})

describe('sofiaMidnightUtc', () => {
  it('returns the DST-correct UTC instant for a summer date', () => {
    expect(sofiaMidnightUtc('2026-07-01').toISOString()).toBe('2026-06-30T21:00:00.000Z')
  })

  it('returns the DST-correct UTC instant for a winter date', () => {
    expect(sofiaMidnightUtc('2026-01-01').toISOString()).toBe('2025-12-31T22:00:00.000Z')
  })
})

describe('sofiaDateKey', () => {
  it('reads the Sofia calendar day, not the UTC day', () => {
    expect(sofiaDateKey('2026-10-22T22:00:00Z')).toBe('2026-10-23')
  })
})

describe('icsAllDayRange', () => {
  it('produces the correct exclusive DTEND for the real prod October row', () => {
    const { start, end } = icsAllDayRange('2026-10-22T22:00:00Z', '2026-10-24T22:00:00Z')
    // Compare via the Sofia date key, not the raw UTC ISO date: a UTC-midnight
    // Date representing Sofia midnight can fall on the previous UTC day.
    expect(sofiaDateKey(start.toISOString())).toBe('2026-10-23')
    expect(sofiaDateKey(end.toISOString())).toBe('2026-10-26')
  })
})
