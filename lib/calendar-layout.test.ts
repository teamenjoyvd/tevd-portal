import { describe, it, expect } from 'vitest'
import { packWeek, MAX_LANES, type LayoutEvent } from '@/lib/calendar-layout'

const WEEK = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']

function ev(id: string, start: string, end: string): LayoutEvent {
  return { id, start_time: `${start}T09:00:00Z`, end_time: `${end}T09:00:00Z` }
}

describe('packWeek', () => {
  it('places a single-day event at its own column, span 1', () => {
    const { segments } = packWeek(WEEK, [ev('a', '2026-10-21', '2026-10-21')])
    expect(segments).toEqual([
      expect.objectContaining({ startCol: 2, span: 1, lane: 0, continuesLeft: false, continuesRight: false }),
    ])
  })

  it('spans a full week', () => {
    const { segments } = packWeek(WEEK, [ev('a', '2026-10-19', '2026-10-25')])
    expect(segments[0]).toMatchObject({ startCol: 0, span: 7, continuesLeft: false, continuesRight: false })
  })

  it('splits a week-boundary crossing span into continuesRight / continuesLeft halves', () => {
    // Event runs Fri 23 -> Mon 26 (26th falls in the next week).
    const nextWeek = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']
    const spanning = ev('a', '2026-10-23', '2026-10-26')

    const week1 = packWeek(WEEK, [spanning])
    expect(week1.segments[0]).toMatchObject({ startCol: 4, span: 3, continuesLeft: false, continuesRight: true })

    const week2 = packWeek(nextWeek, [spanning])
    expect(week2.segments[0]).toMatchObject({ startCol: 0, span: 1, continuesLeft: true, continuesRight: false })
  })

  it('packs two overlapping spans into lanes 0 and 1', () => {
    const a = ev('a', '2026-10-20', '2026-10-22')
    const b = ev('b', '2026-10-21', '2026-10-23')
    const { segments } = packWeek(WEEK, [a, b])
    const byId = Object.fromEntries(segments.map(s => [s.event.id, s.lane]))
    expect(byId.a).toBe(0)
    expect(byId.b).toBe(1)
  })

  it('reuses a freed lane once the earlier segment ends before the next starts', () => {
    const a = ev('a', '2026-10-19', '2026-10-20')
    const b = ev('b', '2026-10-21', '2026-10-22')
    const { segments } = packWeek(WEEK, [a, b])
    const byId = Object.fromEntries(segments.map(s => [s.event.id, s.lane]))
    expect(byId.a).toBe(0)
    expect(byId.b).toBe(0)
  })

  it('drops segments past MAX_LANES and reports a per-column overflow count', () => {
    const events = Array.from({ length: MAX_LANES + 1 }, (_, i) => ev(`e${i}`, '2026-10-21', '2026-10-21'))
    const { segments, overflowByCol } = packWeek(WEEK, events)
    expect(segments).toHaveLength(MAX_LANES)
    expect(overflowByCol[2]).toBe(1)
    expect(overflowByCol.filter(n => n === 0)).toHaveLength(6)
  })

  it('orders deterministically by startCol asc, span desc, start_time, id — independent of input order', () => {
    const wide = ev('wide', '2026-10-20', '2026-10-22')
    const narrow = ev('narrow', '2026-10-20', '2026-10-20')
    const forward = packWeek(WEEK, [narrow, wide]).segments.map(s => s.event.id)
    const backward = packWeek(WEEK, [wide, narrow]).segments.map(s => s.event.id)
    expect(forward).toEqual(['wide', 'narrow'])
    expect(backward).toEqual(['wide', 'narrow'])
  })

  it('ignores events entirely outside the week', () => {
    const { segments } = packWeek(WEEK, [ev('a', '2026-09-01', '2026-09-02')])
    expect(segments).toHaveLength(0)
  })
})
