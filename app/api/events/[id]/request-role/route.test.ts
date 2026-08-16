import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 2608-DEV-749. Nothing covered this route before — the `event_role_requests`
 * references in lib/server/member-registration.test.ts and
 * lib/actions/guest-registration.test.ts are capacity fixtures only.
 *
 * Same fake-Supabase shape as app/api/admin/members/[id]/route.test.ts, with one
 * addition it did not need: this route issues SEVERAL distinct queries against
 * ONE table, and two of them carry a `.in('status', ...)` PRECONDITION that is
 * the whole defence against a read-then-write race. So the fake queues results
 * per table in call order and records every chained call, letting the tests
 * assert that the precondition was actually sent — not just that the happy path
 * returned 200.
 */

type QueryResult = { data: unknown; error: { message: string } | null }
type ChainCall = { table: string; method: string; args: unknown[] }

const OK = (data: unknown): QueryResult => ({ data, error: null })

function makeDb(queues: Record<string, QueryResult[]>) {
  const calls: ChainCall[] = []

  function chainable(table: string): Record<string, unknown> {
    const obj: Record<string, unknown> = {}
    const record = (method: string) => (...args: unknown[]) => {
      calls.push({ table, method, args })
      return obj
    }
    for (const m of ['select', 'eq', 'in', 'order', 'update', 'insert', 'limit', 'is']) {
      obj[m] = record(m)
    }
    const next = (): QueryResult => {
      const q = queues[table]
      if (!q || q.length === 0) throw new Error(`fake supabase: no queued result for "${table}"`)
      return q.shift() as QueryResult
    }
    obj.maybeSingle = () => Promise.resolve(next())
    obj.single = () => Promise.resolve(next())
    obj.then = (resolve: (v: QueryResult) => void, reject: (e: unknown) => void) =>
      Promise.resolve(next()).then(resolve, reject)
    return obj
  }

  const client = { from: (table: string) => chainable(table) } as unknown as SupabaseClient
  return { client, calls }
}

/** Every `.in(...)` sent against event_role_requests, flattened for assertions. */
function statusPreconditions(calls: ChainCall[]): unknown[][] {
  return calls
    .filter(c => c.table === 'event_role_requests' && c.method === 'in')
    .map(c => c.args)
}

const mockAuth = vi.fn()
const mockCreateServiceClient = vi.fn()

vi.mock('@clerk/nextjs/server', () => ({ auth: () => mockAuth() }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => mockCreateServiceClient(),
}))

const EVENT_ID = 'evt_1'
const params = Promise.resolve({ id: EVENT_ID })

/** Far enough out that the 60-minute window is comfortably open. */
const OPEN_EVENT = OK({ start_time: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString() })
/** Inside the 60-minute window — sign-ups and withdrawals are closed. */
const CLOSED_EVENT = OK({ start_time: new Date(Date.now() + 20 * 60 * 1000).toISOString() })

const MEMBER = OK({ id: 'p_member', role: 'member' })
const ADMIN  = OK({ id: 'p_admin',  role: 'admin' })

function postReq(body: unknown): Request {
  return new Request(`http://localhost/api/events/${EVENT_ID}/request-role`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

function deleteReq(): Request {
  return new Request(`http://localhost/api/events/${EVENT_ID}/request-role`, { method: 'DELETE' })
}

beforeEach(() => {
  mockAuth.mockReset()
  mockCreateServiceClient.mockReset()
})

describe('DELETE /api/events/[id]/request-role — member self-withdraw', () => {
  it('cancels an APPROVED request (the whole point of 749) and stamps the actor', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_member' })
    const { client, calls } = makeDb({
      profiles: [MEMBER],
      calendar_events: [OPEN_EVENT],
      event_role_requests: [OK({ id: 'req_1', status: 'cancelled' })],
    })
    mockCreateServiceClient.mockReturnValue(client)
    const { DELETE } = await import('@/app/api/events/[id]/request-role/route')

    const res = await DELETE(deleteReq(), { params })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ cancelled: true, id: 'req_1' })

    const update = calls.find(c => c.table === 'event_role_requests' && c.method === 'update')
    expect(update?.args[0]).toMatchObject({ status: 'cancelled', cancelled_by: 'p_member' })
    expect((update?.args[0] as { cancelled_at: string }).cancelled_at).toEqual(expect.any(String))

    // The precondition is re-asserted at write time — no read-then-write.
    expect(statusPreconditions(calls)).toEqual([['status', ['pending', 'approved']]])
  })

  it('returns 404 with a code when nothing is cancellable — not the old fake 200', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_member' })
    const { client } = makeDb({
      profiles: [MEMBER],
      calendar_events: [OPEN_EVENT],
      event_role_requests: [OK(null)],
    })
    mockCreateServiceClient.mockReturnValue(client)
    const { DELETE } = await import('@/app/api/events/[id]/request-role/route')

    const res = await DELETE(deleteReq(), { params })

    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('nothing_to_cancel')
  })

  it('enforces the cutoff on withdrawal too — it was client-only before', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_member' })
    const { client, calls } = makeDb({
      profiles: [MEMBER],
      calendar_events: [CLOSED_EVENT],
      event_role_requests: [],
    })
    mockCreateServiceClient.mockReturnValue(client)
    const { DELETE } = await import('@/app/api/events/[id]/request-role/route')

    const res = await DELETE(deleteReq(), { params })

    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('role_window_closed')
    // Nothing was written.
    expect(calls.some(c => c.table === 'event_role_requests')).toBe(false)
  })

  it('an admin bypasses the cutoff and never even loads the event', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_admin' })
    const { client, calls } = makeDb({
      profiles: [ADMIN],
      calendar_events: [],
      event_role_requests: [OK({ id: 'req_1', status: 'cancelled' })],
    })
    mockCreateServiceClient.mockReturnValue(client)
    const { DELETE } = await import('@/app/api/events/[id]/request-role/route')

    const res = await DELETE(deleteReq(), { params })

    expect(res.status).toBe(200)
    expect(calls.some(c => c.table === 'calendar_events')).toBe(false)
  })
})

describe('POST /api/events/[id]/request-role — request and revive', () => {
  it('revives a CANCELLED row instead of 23505-ing, clearing the cancel stamp', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_member' })
    const { client, calls } = makeDb({
      profiles: [MEMBER],
      calendar_events: [OPEN_EVENT],
      event_role_requests: [
        OK(null),                                     // slot-filled guard: nobody holds it
        OK({ id: 'req_1', status: 'cancelled' }),     // caller's existing row
        OK({ id: 'req_1', status: 'pending' }),       // the revive UPDATE
      ],
    })
    mockCreateServiceClient.mockReturnValue(client)
    const { POST } = await import('@/app/api/events/[id]/request-role/route')

    const res = await POST(postReq({ role_label: 'HOST' }), { params })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'req_1', status: 'pending' })

    const update = calls.find(c => c.table === 'event_role_requests' && c.method === 'update')
    expect(update?.args[0]).toEqual({
      status: 'pending',
      role_label: 'HOST',
      note: null,
      cancelled_at: null,
      cancelled_by: null,
    })
    expect(statusPreconditions(calls)).toEqual([['status', ['denied', 'cancelled']]])
    // Never an INSERT — UNIQUE (event_id, profile_id) allows exactly one row.
    expect(calls.some(c => c.table === 'event_role_requests' && c.method === 'insert')).toBe(false)
  })

  it('revives a DENIED row — a passed-over member can claim a reopened slot', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_member' })
    const { client } = makeDb({
      profiles: [MEMBER],
      calendar_events: [OPEN_EVENT],
      event_role_requests: [
        OK(null),
        OK({ id: 'req_2', status: 'denied' }),
        OK({ id: 'req_2', status: 'pending' }),
      ],
    })
    mockCreateServiceClient.mockReturnValue(client)
    const { POST } = await import('@/app/api/events/[id]/request-role/route')

    const res = await POST(postReq({ role_label: 'SPEAKER' }), { params })
    expect(res.status).toBe(200)
  })

  it('409s when the caller already holds an APPROVED row — never downgrades it', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_member' })
    const { client, calls } = makeDb({
      profiles: [MEMBER],
      calendar_events: [OPEN_EVENT],
      event_role_requests: [
        OK(null),
        OK({ id: 'req_3', status: 'approved' }),
      ],
    })
    mockCreateServiceClient.mockReturnValue(client)
    const { POST } = await import('@/app/api/events/[id]/request-role/route')

    const res = await POST(postReq({ role_label: 'HOST' }), { params })

    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('already_requested')
    expect(calls.some(c => c.table === 'event_role_requests' && c.method === 'update')).toBe(false)
  })

  it('409s when the revive precondition matches zero rows — the race case', async () => {
    // An admin approved this member's denied row between our read and our write.
    // The `.in('status', ['denied','cancelled'])` filter makes the UPDATE match
    // nothing, and we must NOT retry: retrying would clobber 'approved'.
    mockAuth.mockResolvedValue({ userId: 'clerk_member' })
    const { client, calls } = makeDb({
      profiles: [MEMBER],
      calendar_events: [OPEN_EVENT],
      event_role_requests: [
        OK(null),
        OK({ id: 'req_4', status: 'denied' }),
        OK(null),                                     // UPDATE matched zero rows
      ],
    })
    mockCreateServiceClient.mockReturnValue(client)
    const { POST } = await import('@/app/api/events/[id]/request-role/route')

    const res = await POST(postReq({ role_label: 'HOST' }), { params })

    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('state_changed')
    expect(calls.filter(c => c.table === 'event_role_requests' && c.method === 'update')).toHaveLength(1)
  })

  it('inserts a fresh row when the caller has never requested here', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_member' })
    const { client, calls } = makeDb({
      profiles: [MEMBER],
      calendar_events: [OPEN_EVENT],
      event_role_requests: [
        OK(null),
        OK(null),
        OK({ id: 'req_5', status: 'pending' }),
      ],
    })
    mockCreateServiceClient.mockReturnValue(client)
    const { POST } = await import('@/app/api/events/[id]/request-role/route')

    const res = await POST(postReq({ role_label: 'HOST' }), { params })

    expect(res.status).toBe(201)
    const insert = calls.find(c => c.table === 'event_role_requests' && c.method === 'insert')
    expect(insert?.args[0]).toEqual({
      event_id: EVENT_ID, profile_id: 'p_member', role_label: 'HOST', note: null,
    })
  })

  it('409s with slot_filled when someone else already holds the role', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_member' })
    const { client } = makeDb({
      profiles: [MEMBER],
      calendar_events: [OPEN_EVENT],
      event_role_requests: [OK({ status: 'approved' })],
    })
    mockCreateServiceClient.mockReturnValue(client)
    const { POST } = await import('@/app/api/events/[id]/request-role/route')

    const res = await POST(postReq({ role_label: 'HOST' }), { params })

    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('slot_filled')
  })

  it('403s past the cutoff with a code the popup can toast on', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_member' })
    const { client } = makeDb({
      profiles: [MEMBER],
      calendar_events: [CLOSED_EVENT],
      event_role_requests: [],
    })
    mockCreateServiceClient.mockReturnValue(client)
    const { POST } = await import('@/app/api/events/[id]/request-role/route')

    const res = await POST(postReq({ role_label: 'HOST' }), { params })

    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('role_window_closed')
  })

  it('401s when unauthenticated and touches no table', async () => {
    mockAuth.mockResolvedValue({ userId: null })
    const { client, calls } = makeDb({})
    mockCreateServiceClient.mockReturnValue(client)
    const { POST } = await import('@/app/api/events/[id]/request-role/route')

    const res = await POST(postReq({ role_label: 'HOST' }), { params })
    expect(res.status).toBe(401)
    expect(calls).toHaveLength(0)
  })

  it('403s a guest before any role work happens', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_guest' })
    const { client, calls } = makeDb({ profiles: [OK({ id: 'p_guest', role: 'guest' })] })
    mockCreateServiceClient.mockReturnValue(client)
    const { POST } = await import('@/app/api/events/[id]/request-role/route')

    const res = await POST(postReq({ role_label: 'HOST' }), { params })
    expect(res.status).toBe(403)
    expect(calls.some(c => c.table === 'event_role_requests')).toBe(false)
  })
})
