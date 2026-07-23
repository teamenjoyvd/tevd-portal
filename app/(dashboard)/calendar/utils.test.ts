import { describe, expect, it } from 'vitest'
import {
  isoWeek,
  startOfWeek,
  addDays,
  sameDaySofia,
  toMonthParam,
  formatTime,
  formatShortDate,
  eventMinutesFromMidnight,
  eventDurationMinutes,
} from '@/app/(dashboard)/calendar/utils'

describe('isoWeek', () => {
  it('returns ISO week 1 for the first Monday of the year', () => {
    expect(isoWeek(new Date('2027-01-04T12:00:00Z'))).toBe(1)
  })

  it('returns week 53 for the last days of a 53-week year', () => {
    expect(isoWeek(new Date('2026-12-31T12:00:00Z'))).toBe(53)
  })
})

describe('startOfWeek', () => {
  it('rolls a Wednesday back to the preceding Monday', () => {
    const d = startOfWeek(new Date('2026-03-18T15:00:00'))
    expect(d.getDay()).toBe(1)
    expect(d.getDate()).toBe(16)
  })

  it('treats Sunday as the end of the week (rolls back 6 days)', () => {
    const d = startOfWeek(new Date('2026-03-22T15:00:00'))
    expect(d.getDay()).toBe(1)
    expect(d.getDate()).toBe(16)
  })
})

describe('addDays', () => {
  it('adds a positive day count', () => {
    const d = addDays(new Date('2026-03-18T00:00:00'), 5)
    expect(d.getDate()).toBe(23)
  })

  it('subtracts with a negative day count', () => {
    const d = addDays(new Date('2026-03-18T00:00:00'), -5)
    expect(d.getDate()).toBe(13)
  })

  it('rolls across a month boundary', () => {
    const d = addDays(new Date('2026-03-30T00:00:00'), 3)
    expect(d.getMonth()).toBe(3)
    expect(d.getDate()).toBe(2)
  })
})

describe('sameDaySofia', () => {
  // 00:30Z is 02:30 EET (before the transition); 01:30Z is 04:30 EEST
  // (after the skipped hour) — opposite sides of the spring-forward instant.
  it('treats two UTC instants as the same Sofia day across the DST spring-forward boundary', () => {
    const a = new Date('2026-03-29T00:30:00.000Z')
    const b = new Date('2026-03-29T01:30:00.000Z')
    expect(sameDaySofia(a, b)).toBe(true)
  })

  // 2026-10-24T22:30:00Z is 2026-10-25 01:30 Sofia (EEST +3, before fall-back);
  // 2026-10-25T21:30:00Z is 2026-10-25 23:30 Sofia — still the same Sofia day post fall-back.
  it('treats two UTC instants as the same Sofia day across the DST fall-back boundary', () => {
    const a = new Date('2026-10-24T22:30:00.000Z')
    const b = new Date('2026-10-25T21:30:00.000Z')
    expect(sameDaySofia(a, b)).toBe(true)
  })

  it('returns false for two different Sofia calendar days', () => {
    const a = new Date('2026-03-18T12:00:00.000Z')
    const b = new Date('2026-03-19T12:00:00.000Z')
    expect(sameDaySofia(a, b)).toBe(false)
  })
})

describe('toMonthParam', () => {
  it('formats as YYYY-MM with zero-padded month', () => {
    expect(toMonthParam(new Date('2026-03-18T00:00:00'))).toBe('2026-03')
  })

  it('zero-pads a single-digit month', () => {
    expect(toMonthParam(new Date('2026-01-05T00:00:00'))).toBe('2026-01')
  })
})

describe('formatTime', () => {
  // 2026-03-18T12:00:00Z -> 14:00 Sofia (EET +2, before spring-forward)
  it('formats as HH:mm in Europe/Sofia before spring-forward', () => {
    expect(formatTime('2026-03-18T12:00:00.000Z')).toBe('14:00')
  })

  // 2026-07-18T12:00:00Z -> 15:00 Sofia (EEST +3, summer)
  it('formats as HH:mm in Europe/Sofia during EEST', () => {
    expect(formatTime('2026-07-18T12:00:00.000Z')).toBe('15:00')
  })
})

describe('formatShortDate', () => {
  it('formats as short weekday + day + month in Europe/Sofia', () => {
    expect(formatShortDate(new Date('2026-03-18T12:00:00.000Z'))).toBe('Wed 18 Mar')
  })
})

describe('eventMinutesFromMidnight', () => {
  it('returns minutes elapsed since local midnight', () => {
    const d = new Date()
    d.setHours(9, 30, 0, 0)
    expect(eventMinutesFromMidnight(d.toISOString())).toBe(9 * 60 + 30)
  })

  it('returns 0 at local midnight', () => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    expect(eventMinutesFromMidnight(d.toISOString())).toBe(0)
  })
})

describe('eventDurationMinutes', () => {
  it('returns the elapsed minutes between start and end', () => {
    expect(eventDurationMinutes('2026-03-18T10:00:00Z', '2026-03-18T11:30:00Z')).toBe(90)
  })

  it('floors durations under 30 minutes to a 30-minute minimum', () => {
    expect(eventDurationMinutes('2026-03-18T10:00:00Z', '2026-03-18T10:10:00Z')).toBe(30)
  })
})
