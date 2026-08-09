import { describe, expect, it, vi } from 'vitest'

const mockCreateServiceClient = vi.fn()
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => mockCreateServiceClient(),
}))

import { buildEventDescription, toVEventInput, listEventsForRole } from '@/lib/server/calendar'

const PORTAL = 'https://portal.example'

describe('buildEventDescription', () => {
  it('returns just the portal pointer when no description or detail fields are set', () => {
    expect(
      buildEventDescription({ id: 'ev-1', description: null, location: null, category: null }, PORTAL),
    ).toMatchInlineSnapshot(`"Details: https://portal.example/calendar?event=ev-1"`)
  })

  it('returns the base description plus the portal pointer when no other detail fields are set', () => {
    expect(
      buildEventDescription({
        id: 'ev-1',
        description: 'Monthly N21 meetup',
        location: null,
        category: null,
      }, PORTAL),
    ).toMatchInlineSnapshot(`
      "Monthly N21 meetup

      Details: https://portal.example/calendar?event=ev-1"
    `)
  })

  it('returns just the detail lines when there is no base description', () => {
    expect(
      buildEventDescription({
        id: 'ev-1',
        description: null,
        location: 'Sofia HQ',
        category: 'N21',
      }, PORTAL),
    ).toMatchInlineSnapshot(`
      "Location: Sofia HQ
      Details: https://portal.example/calendar?event=ev-1
      Category: N21"
    `)
  })

  it('joins the base description and detail lines with a blank line (Phase 1c format)', () => {
    expect(
      buildEventDescription({
        id: 'ev-1',
        description: 'Monthly N21 meetup',
        location: 'Sofia HQ',
        category: 'N21',
      }, PORTAL),
    ).toMatchInlineSnapshot(`
      "Monthly N21 meetup

      Location: Sofia HQ
      Details: https://portal.example/calendar?event=ev-1
      Category: N21"
    `)
  })

  it('omits a detail line whose field is an empty string', () => {
    expect(
      buildEventDescription({
        id: 'ev-1',
        description: 'Monthly N21 meetup',
        location: '',
        category: null,
      }, PORTAL),
    ).toMatchInlineSnapshot(`
      "Monthly N21 meetup

      Details: https://portal.example/calendar?event=ev-1"
    `)
  })

  it('omits the category line when category is an empty string', () => {
    expect(
      buildEventDescription({
        id: 'ev-1',
        description: 'Monthly N21 meetup',
        location: null,
        category: '',
      }, PORTAL),
    ).toMatchInlineSnapshot(`
      "Monthly N21 meetup

      Details: https://portal.example/calendar?event=ev-1"
    `)
  })

  // Google event ids are opaque and have historically contained characters that
  // are not URL-safe; the pointer must survive them rather than silently
  // truncating the query string.
  it('URL-encodes the event id in the portal pointer', () => {
    expect(
      buildEventDescription({ id: 'a b&c=d', description: null, location: null, category: null }, PORTAL),
    ).toMatchInlineSnapshot(`"Details: https://portal.example/calendar?event=a%20b%26c%3Dd"`)
  })

  // 2608-DEV-703 / epic #702 D8: the meeting link must never reach the ICS
  // payload. A subscribed client refreshes every 15 minutes for a year, which
  // would bypass the meeting-link gate passively.
  it('ignores a stale meeting_url still present on the incoming row', () => {
    // Passed as a variable, not a literal, so TS structural typing lets the
    // extra property through — this is what a caller left un-migrated would do.
    const legacyRow = {
      id: 'ev-1',
      description: null,
      location: null,
      category: null,
      meeting_url: 'https://meet.example.com/abc',
    }
    const out = buildEventDescription(legacyRow, PORTAL)
    expect(out).not.toContain('meet.example.com')
    expect(out).toBe('Details: https://portal.example/calendar?event=ev-1')
  })
})

describe('toVEventInput', () => {
  it('emits the correct all-day date range for the real prod October event', () => {
    const input = toVEventInput({
      id: '5o3mircbst1a1v1mc4j1hrnirq',
      title: 'WES event',
      description: null,
      location: null,
      category: null,
      is_all_day: true,
      start_time: '2026-10-22T22:00:00Z',
      end_time: '2026-10-24T22:00:00Z',
    }, PORTAL)
    // ical-generator serializes allDay dates via UTC getters (no calendar
    // timezone set) — assert the UTC date directly, matching what actually
    // lands in DTSTART;VALUE=DATE / DTEND;VALUE=DATE.
    expect((input.start as Date).toISOString().slice(0, 10)).toBe('2026-10-23')
    expect((input.end as Date).toISOString().slice(0, 10)).toBe('2026-10-26')
    expect(input.allDay).toBe(true)
  })

  it('serializes to the exact expected VEVENT date-only lines (regression: ical-generator uses UTC getters for allDay)', async () => {
    const ical = (await import('ical-generator')).default
    const calendar = ical({ name: 'test' })
    calendar.createEvent(
      toVEventInput({
        id: '5o3mircbst1a1v1mc4j1hrnirq',
        title: 'WES event',
        description: null,
        location: null,
        category: null,
        is_all_day: true,
        start_time: '2026-10-22T22:00:00Z',
        end_time: '2026-10-24T22:00:00Z',
      }, PORTAL),
    )
    const output = calendar.toString()
    expect(output).toContain('DTSTART;VALUE=DATE:20261023')
    expect(output).toContain('DTEND;VALUE=DATE:20261026')
  })

  it('passes timed event start/end straight through as UTC instants', () => {
    const input = toVEventInput({
      id: 'timed-1',
      title: 'Meeting',
      description: null,
      location: null,
      category: null,
      is_all_day: false,
      start_time: '2026-06-15T10:00:00Z',
      end_time: '2026-06-15T11:00:00Z',
    }, PORTAL)
    expect((input.start as Date).toISOString()).toBe('2026-06-15T10:00:00.000Z')
    expect(input.allDay).toBe(false)
  })

  // 2608-DEV-703 / epic #702 D8. Before this change `url` carried
  // meeting_url, so one feed subscription handed out every meeting link for a
  // 365-day window, refreshed every 15 minutes — passively defeating the gate.
  it('sets the VEVENT url to the portal event page, not the meeting link', () => {
    const input = toVEventInput({
      id: 'timed-1',
      title: 'Meeting',
      description: null,
      location: null,
      category: null,
      is_all_day: false,
      start_time: '2026-06-15T10:00:00Z',
      end_time: '2026-06-15T11:00:00Z',
    }, PORTAL)
    expect(input.url).toBe('https://portal.example/calendar?event=timed-1')
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

// 2608-DEV-703 / epic #702 D8. /api/calendar is on the public allowlist and
// resolves sessionless callers to role 'guest', so every column named here
// reaches anonymous visitors. The overlap test above asserts nothing about the
// column string — its mock is `select: () => chain`, which swallows the
// argument entirely — so without this the projection could regain meeting_url
// with every test still green.
describe('listEventsForRole projection', () => {
  it('never selects meeting_url', async () => {
    const select = vi.fn()
    const chain: Record<string, unknown> = {}
    Object.assign(chain, {
      contains: vi.fn().mockReturnValue(chain),
      order: vi.fn().mockReturnValue(chain),
      gte: vi.fn().mockReturnValue(chain),
      lt: vi.fn().mockReturnValue(chain),
      limit: vi.fn().mockReturnValue(chain),
      then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
    })
    select.mockReturnValue(chain)

    mockCreateServiceClient.mockReturnValue({ from: () => ({ select }) })

    await listEventsForRole({ role: 'guest' })

    expect(select).toHaveBeenCalledTimes(1)
    const columns = select.mock.calls[0][0] as string
    expect(columns).not.toContain('meeting_url')
    // Guard the whole projection, not just the one column: a future addition
    // lands here as a failure to be reviewed rather than shipping silently.
    expect(columns.split(',').map(c => c.trim())).toEqual([
      'id',
      'title',
      'description',
      'start_time',
      'end_time',
      'category',
      'event_type',
      'week_number',
      'access_roles',
      'is_all_day',
      'location',
    ])
  })
})
