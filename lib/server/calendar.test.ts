import { describe, expect, it, vi } from 'vitest'

const mockCreateServiceClient = vi.fn()
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => mockCreateServiceClient(),
}))

import { buildEventDescription, toVEventInput, listEventsForRole } from '@/lib/server/calendar'
import { sofiaDateKey } from '@/lib/calendar-dates'

describe('buildEventDescription', () => {
  it('returns undefined when no description or detail fields are set', () => {
    expect(
      buildEventDescription({ description: null, location: null, meeting_url: null, category: null }),
    ).toMatchInlineSnapshot(`undefined`)
  })

  it('returns just the base description when no detail fields are set', () => {
    expect(
      buildEventDescription({
        description: 'Monthly N21 meetup',
        location: null,
        meeting_url: null,
        category: null,
      }),
    ).toMatchInlineSnapshot(`"Monthly N21 meetup"`)
  })

  it('returns just the detail lines when there is no base description', () => {
    expect(
      buildEventDescription({
        description: null,
        location: 'Sofia HQ',
        meeting_url: 'https://meet.example.com/abc',
        category: 'N21',
      }),
    ).toMatchInlineSnapshot(`
      "Location: Sofia HQ
      Meeting link: https://meet.example.com/abc
      Category: N21"
    `)
  })

  it('joins the base description and detail lines with a blank line (Phase 1c format)', () => {
    expect(
      buildEventDescription({
        description: 'Monthly N21 meetup',
        location: 'Sofia HQ',
        meeting_url: 'https://meet.example.com/abc',
        category: 'N21',
      }),
    ).toMatchInlineSnapshot(`
      "Monthly N21 meetup

      Location: Sofia HQ
      Meeting link: https://meet.example.com/abc
      Category: N21"
    `)
  })

  it('omits a detail line whose field is an empty string', () => {
    expect(
      buildEventDescription({
        description: 'Monthly N21 meetup',
        location: '',
        meeting_url: 'https://meet.example.com/abc',
        category: null,
      }),
    ).toMatchInlineSnapshot(`
      "Monthly N21 meetup

      Meeting link: https://meet.example.com/abc"
    `)
  })

  it('omits the category line when category is an empty string', () => {
    expect(
      buildEventDescription({
        description: 'Monthly N21 meetup',
        location: null,
        meeting_url: null,
        category: '',
      }),
    ).toMatchInlineSnapshot(`"Monthly N21 meetup"`)
  })
})

describe('toVEventInput', () => {
  it('emits the correct all-day date range for the real prod October event', () => {
    const input = toVEventInput({
      id: '5o3mircbst1a1v1mc4j1hrnirq',
      title: 'WES event',
      description: null,
      location: null,
      meeting_url: null,
      category: null,
      is_all_day: true,
      start_time: '2026-10-22T22:00:00Z',
      end_time: '2026-10-24T22:00:00Z',
    })
    expect(sofiaDateKey((input.start as Date).toISOString())).toBe('2026-10-23')
    expect(sofiaDateKey((input.end as Date).toISOString())).toBe('2026-10-26')
    expect(input.allDay).toBe(true)
  })

  it('passes timed event start/end straight through as UTC instants', () => {
    const input = toVEventInput({
      id: 'timed-1',
      title: 'Meeting',
      description: null,
      location: null,
      meeting_url: null,
      category: null,
      is_all_day: false,
      start_time: '2026-06-15T10:00:00Z',
      end_time: '2026-06-15T11:00:00Z',
    })
    expect((input.start as Date).toISOString()).toBe('2026-06-15T10:00:00.000Z')
    expect(input.allDay).toBe(false)
  })
})

describe('listEventsForRole overlap semantics', () => {
  it('includes an event that starts before the window but is still ongoing', async () => {
    const gte = vi.fn().mockReturnThis()
    const lt = vi.fn().mockReturnThis()
    const chain: Record<string, unknown> = {}
    const overlappingEvent = { id: 'e1', start_time: '2026-09-28T00:00:00Z', end_time: '2026-10-02T00:00:00Z' }
    Object.assign(chain, {
      contains: vi.fn().mockReturnValue(chain),
      order: vi.fn().mockReturnValue(chain),
      gte,
      lt,
      limit: vi.fn().mockReturnValue(chain),
      then: (resolve: (v: unknown) => void) => resolve({ data: [overlappingEvent], error: null }),
    })
    gte.mockReturnValue(chain)
    lt.mockReturnValue(chain)

    mockCreateServiceClient.mockReturnValue({
      from: () => ({ select: () => chain }),
    })

    const result = await listEventsForRole({ role: 'member', from: '2026-10-01T00:00:00Z', to: '2026-11-01T00:00:00Z' })
    expect(result).toEqual([overlappingEvent])
    expect(lt).toHaveBeenCalledWith('start_time', '2026-11-01T00:00:00Z')
    expect(gte).toHaveBeenCalledWith('end_time', '2026-10-01T00:00:00Z')
  })
})
