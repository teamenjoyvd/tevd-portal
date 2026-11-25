import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRegistrant, deleteRegistrant, getWebinar, resetTokenCache, ZoomError } from './client'
import { createZoomPort, splitName } from './port'
import { importAllSeries, importSeries, isoWeek } from './sessions'

type Client = Parameters<typeof createZoomPort>[0]
const EVENT = '12345678901'
const json = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status })
const token = (expires_in = 3600) => json(200, { access_token: 'tok', expires_in })
const person = { email: 'ann@example.com', first_name: 'Ann', last_name: 'Lee' }
const registrant = { registrant_id: 'r1', join_url: 'https://zoom.us/w/1?tk=x' }

const mockFetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>()
const apiCalls = () => mockFetch.mock.calls.filter(([url]) => !url.includes('/oauth/token'))
const tokenCalls = () => mockFetch.mock.calls.filter(([url]) => url.includes('/oauth/token'))

/** Queue API answers; the token endpoint always succeeds. */
function answer(...responses: (() => Response)[]) {
  mockFetch.mockImplementation(async (url) => {
    if (url.includes('/oauth/token')) return token()
    const next = responses.shift()
    if (next === undefined) throw new Error('unexpected call')
    return next()
  })
}

beforeEach(() => {
  resetTokenCache()
  mockFetch.mockReset()
  vi.stubGlobal('fetch', mockFetch)
  vi.stubEnv('VERCEL_ENV', 'preview')
  vi.stubEnv('ZOOM_ACCOUNT_ID', 'acc')
  vi.stubEnv('ZOOM_CLIENT_ID', 'id')
  vi.stubEnv('ZOOM_CLIENT_SECRET', 'sec')
  vi.stubEnv('ZOOM_ALLOWED_EVENT_IDS', '999999999, 123 4567 8901')
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('token', () => {
  it('is reused until under a minute remains', async () => {
    vi.useFakeTimers()
    answer(() => json(201, registrant), () => json(201, registrant), () => json(201, registrant))
    await createRegistrant(EVENT, 's1', person)
    vi.advanceTimersByTime(3_500_000)
    await createRegistrant(EVENT, 's1', person)
    expect(tokenCalls()).toHaveLength(1)
    vi.advanceTimersByTime(50_000)
    await createRegistrant(EVENT, 's1', person)
    expect(tokenCalls()).toHaveLength(2)
  })

  it('is requested again once on 401, then gives up', async () => {
    answer(() => json(401), () => json(201, registrant))
    await createRegistrant(EVENT, 's1', person)
    expect(tokenCalls()).toHaveLength(2)

    answer(() => json(401), () => json(401))
    await expect(createRegistrant(EVENT, 's1', person)).rejects.toMatchObject({ kind: 'permanent', status: 401 })
  })
})

describe('errors', () => {
  it.each([
    [500, {}, 'retryable'],
    [429, { message: 'Too many requests' }, 'retryable'],
    [429, { code: 429, message: 'You have exceeded the daily rate limit (3)' }, 'permanent'],
    [400, { code: 300 }, 'permanent'],
    [404, {}, 'permanent'],
  ])('%i %j is %s', async (status, body, kind) => {
    answer(() => json(status, body))
    await expect(createRegistrant(EVENT, 's1', person)).rejects.toMatchObject({ kind, status })
  })

  it('treats a network failure as retryable', async () => {
    mockFetch.mockRejectedValue(new Error('down'))
    await expect(createRegistrant(EVENT, 's1', person)).rejects.toMatchObject({ kind: 'retryable' })
  })

  it('rejects an answer without a join link', async () => {
    answer(() => json(201, { registrant_id: 'r1' }))
    await expect(createRegistrant(EVENT, 's1', person)).rejects.toBeInstanceOf(ZoomError)
  })

  it('does not put the response text in the error', async () => {
    answer(() => json(400, { code: 300, message: 'ann@example.com is invalid' }))
    const error = await createRegistrant(EVENT, 's1', person).catch((e: Error) => e)
    expect(String(error)).not.toContain('ann@')
  })
})

describe('allowlist', () => {
  it.each([
    ['register', () => createRegistrant('55555555555', 's1', person)],
    ['cancel', () => deleteRegistrant('55555555555', 's1', 'r1')],
    ['linking', () => getWebinar('55555555555')],
  ])('refuses %s of an unlisted event without calling Zoom', async (_label, run) => {
    await expect(run()).rejects.toMatchObject({ status: 403 })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('refuses everything when unset', async () => {
    vi.stubEnv('ZOOM_ALLOWED_EVENT_IDS', '')
    await expect(getWebinar(EVENT)).rejects.toMatchObject({ status: 403 })
  })

  it('does not apply in production', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    answer(() => json(201, registrant))
    await createRegistrant('55555555555', 's1', person)
    expect(apiCalls()).toHaveLength(1)
  })
})

describe('splitName', () => {
  it.each([
    ['Ann Lee', 'Ann', 'Lee'],
    [' Ann  Maria Lee ', 'Ann Maria', 'Lee'],
    ['Ann', 'Ann', '-'],
  ])('%s', (name, first_name, last_name) => expect(splitName(name)).toEqual({ first_name, last_name }))
})

describe('port', () => {
  const client = (row: unknown) =>
    ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }) }) as unknown as Client
  const linked = { zoom_event_ref: EVENT, zoom_session_ref: 's1' }

  it('creates, then approves', async () => {
    answer(() => json(201, registrant), () => new Response(null, { status: 204 }))
    const result = await createZoomPort(client(linked)).register({ eventId: 'e', admissionId: 'a', name: 'Ann Lee', email: 'ann@example.com' })
    expect(result).toEqual({ ref: 'r1', joinLink: registrant.join_url })
    const [create, approve] = apiCalls()
    expect(create[0]).toContain(`/webinars/${EVENT}/registrants?occurrence_ids=s1`)
    expect(approve[0]).toContain('/registrants/status?occurrence_id=s1')
    expect(JSON.parse(String(approve[1].body))).toMatchObject({ action: 'approve', registrants: [{ id: 'r1' }] })
  })

  it('fails when approval fails, so no pending link is stored', async () => {
    answer(() => json(201, registrant), () => json(500))
    await expect(
      createZoomPort(client(linked)).register({ eventId: 'e', admissionId: 'a', name: 'Ann Lee', email: 'ann@example.com' }),
    ).rejects.toMatchObject({ kind: 'retryable' })
  })

  // Zoom answers 400 / 3000 (recorded 2026-11-25); 404 is what its API would suggest.
  it.each([
    [400, { code: 3000, message: 'Registrant r1 was not found.' }],
    [404, {}],
  ])('cancels with DELETE, and an already gone registration (%i) is fine', async (status, body) => {
    answer(() => json(status, body))
    await createZoomPort(client(linked)).cancel({ eventId: 'e', ref: 'r1' })
    expect(apiCalls()[0][1].method).toBe('DELETE')
    expect(apiCalls()[0][0]).toContain('/registrants/r1?occurrence_id=s1')
  })

  it.each([
    [400, { code: 300 }],
    [400, {}],
    [403, { code: 3000 }],
    [429, { code: 3000 }],
    [500, { code: 3000 }],
  ])('does not take another failed cancel (%i %j) for gone', async (status, body) => {
    answer(() => json(status, body))
    await expect(createZoomPort(client(linked)).cancel({ eventId: 'e', ref: 'r1' })).rejects.toMatchObject({ status })
  })

  it('refuses an event that is not linked', async () => {
    await expect(
      createZoomPort(client({ zoom_event_ref: null, zoom_session_ref: null })).cancel({ eventId: 'e', ref: 'r1' }),
    ).rejects.toMatchObject({ kind: 'permanent' })
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

// ── Sessions ────────────────────────────────────────────────────────────────

type Row = Record<string, unknown> & { id: string }
/** In-memory calendar_events, profiles and member_notifications. */
function fakeDb(tables: Record<string, Row[]>) {
  let n = 0
  const from = (name: string) => {
    const rows = (tables[name] ??= [])
    const filters: ((r: Row) => boolean)[] = []
    let patch: Record<string, unknown> | null = null
    const query = {
      select: () => query,
      order: () => query,
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), query),
      not: (c: string, _op: string, v: unknown) => (filters.push((r) => r[c] !== v), query),
      update: (p: Record<string, unknown>) => ((patch = p), query),
      insert: async (list: Record<string, unknown>[]) => {
        rows.push(...list.map((r) => ({ ...r, id: `${name}${n++}` })))
        return { error: null }
      },
      upsert: async (list: Record<string, unknown>[]) => {
        for (const r of list) {
          if (!rows.some((x) => x.zoom_event_ref === r.zoom_event_ref && x.zoom_session_ref === r.zoom_session_ref)) {
            rows.push({ tickets_cancelled_at: null, ...r, id: `${name}${n++}` })
          }
        }
        return { error: null }
      },
      then: (resolve: (v: unknown) => void) => {
        const hit = rows.filter((r) => filters.every((f) => f(r)))
        if (patch !== null) for (const r of hit) Object.assign(r, patch)
        resolve({ data: hit.map((r) => ({ ...r })), error: null })
      },
    }
    return query
  }
  return { from } as unknown as Client
}

const DAY = 86_400_000
const at = (days: number) => new Date(Math.floor(Date.now() / 1000) * 1000 + days * DAY).toISOString()
const occurrence = (id: string, days: number, status = 'available') => ({ occurrence_id: id, start_time: at(days), duration: 90, status })
const webinar = (over: object = {}) => ({
  topic: 'Tuesday',
  type: 9,
  settings: { registration_type: 2, approval_type: 1 },
  occurrences: [occurrence('a', 1), occurrence('b', 8), occurrence('c', 15), occurrence('gone', 22, 'deleted')],
  ...over,
})
const config = { eventRef: EVENT, seriesKey: 'tuesday', eventType: 'hybrid' as const, inPersonCapacity: 60, onlineCapacity: 100 }

describe('importSeries', () => {
  it('imports available sessions once, with no public link', async () => {
    const tables: Record<string, Row[]> = {}
    const db = fakeDb(tables)
    answer(() => json(200, webinar()), () => json(200, webinar()))
    expect(await importSeries(db, config)).toMatchObject({ ok: true, created: 3, future: 3, vanished: [] })
    expect(await importSeries(db, config)).toMatchObject({ ok: true, created: 0, updated: 0 })
    expect(tables.calendar_events).toHaveLength(3)
    expect(tables.calendar_events[0]).toMatchObject({
      source: 'zoom', series_key: 'tuesday', in_person_capacity: 60, online_capacity: 100, allow_guest_registration: false,
    })
    expect(tables.calendar_events[0].meeting_url ?? null).toBeNull()
    expect(apiCalls().every(([, init]) => init.method === 'GET')).toBe(true)
  })

  it('moves a moved session, and lists a vanished one without deleting it', async () => {
    const tables: Record<string, Row[]> = {}
    const db = fakeDb(tables)
    const moved = occurrence('a', 2)
    answer(() => json(200, webinar()), () => json(200, webinar({ occurrences: [moved, occurrence('b', 8)] })))
    await importSeries(db, config)
    const result = await importSeries(db, config)
    expect(result).toMatchObject({ ok: true, created: 0, updated: 1 })
    expect(result.ok && result.vanished).toHaveLength(1)
    expect(tables.calendar_events).toHaveLength(3)
    expect(tables.calendar_events.find((r) => r.zoom_session_ref === 'a')?.start_time).toBe(moved.start_time)
  })

  it.each([
    ['not_recurring', webinar({ type: 5 })],
    ['wrong_settings', webinar({ settings: { registration_type: 1, approval_type: 1 } })],
    ['wrong_settings', webinar({ settings: { registration_type: 2, approval_type: 0 } })],
    ['wrong_settings', webinar({ settings: {} })],
  ])('refuses with %s', async (code, body) => {
    const tables: Record<string, Row[]> = {}
    answer(() => json(200, body))
    expect(await importSeries(fakeDb(tables), config)).toEqual({ ok: false, code })
    expect(tables.calendar_events ?? []).toHaveLength(0)
  })

  it('refuses to relink the webinar under another series', async () => {
    const db = fakeDb({})
    answer(() => json(200, webinar()), () => json(200, webinar()))
    await importSeries(db, config)
    expect(await importSeries(db, { ...config, seriesKey: 'monday' })).toEqual({ ok: false, code: 'other_series' })
  })
})

describe('importAllSeries', () => {
  it('copies the series settings onto new sessions and stays quiet', async () => {
    const tables: Record<string, Row[]> = { profiles: [{ id: 'p1', role: 'admin' }] }
    const db = fakeDb(tables)
    const more = [...webinar().occurrences, occurrence('d', 29)]
    answer(() => json(200, webinar()), () => json(200, webinar({ occurrences: more })))
    await importSeries(db, config)
    expect(await importAllSeries(db)).toEqual({ series: 1, problems: 0 })
    expect(tables.calendar_events.find((r) => r.zoom_session_ref === 'd')).toMatchObject({ in_person_capacity: 60 })
    expect(tables.member_notifications ?? []).toHaveLength(0)
  })

  it('tells every admin, and only admins, when few sessions remain or the import fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const tables: Record<string, Row[]> = {
      profiles: [{ id: 'p1', role: 'admin' }, { id: 'p2', role: 'admin' }, { id: 'p3', role: 'core' }],
    }
    const db = fakeDb(tables)
    const short = webinar({ occurrences: [occurrence('a', 1)] })
    answer(() => json(200, short), () => json(200, short), () => json(500))
    await importSeries(db, config)
    expect(await importAllSeries(db)).toMatchObject({ problems: 1 })
    expect(tables.member_notifications.map((r) => r.profile_id)).toEqual(['p1', 'p2'])
    expect(await importAllSeries(db)).toMatchObject({ problems: 1 })
  })
})

describe('isoWeek', () => {
  it.each([
    ['2026-01-01T12:00:00Z', 1],
    ['2026-12-31T12:00:00Z', 53],
    ['2027-01-03T12:00:00Z', 53],
    // Sunday 22:30 UTC is already Monday in Sofia.
    ['2026-11-22T22:30:00Z', 48],
  ])('%s is week %i', (iso, week) => expect(isoWeek(iso)).toBe(week))
})
