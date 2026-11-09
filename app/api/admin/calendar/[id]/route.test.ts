import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// 2608-DEV-764. The calendar sync used to delete events that had left its
// window, and guest_registrations.event_id cascaded — member-entered
// registrations disappeared with no trace. The FK is ON DELETE RESTRICT now,
// which means the ONLY way an admin can destroy registrations is this route
// deciding to. These tests pin that decision:
//   - a bare DELETE on an event with registrations must refuse (409) and must
//     not reach any delete,
//   - the confirmed DELETE must go through the atomic RPC, never a bare
//     `.delete()` that would leave the registrations gone and the event alive,
//   - an event with no registrations keeps the plain path.

type Result = { data?: unknown; error: { message: string } | null; count?: number | null }

/** One recorded supabase-js call chain, so a test can assert what was issued. */
type Issued = { table: string; ops: string[] }

const issued: Issued[] = []

/**
 * Chainable stub. `resolve` decides the result from the table and the ops seen,
 * which is what distinguishes the three guest_registrations/calendar_events
 * queries this handler makes from each other.
 */
function chainable(table: string, resolve: (c: Issued) => Result): Record<string, unknown> {
  const call: Issued = { table, ops: [] }
  issued.push(call)
  const obj: Record<string, unknown> = {}
  for (const op of ['select', 'eq', 'is', 'or', 'delete', 'update', 'insert', 'order']) {
    obj[op] = (...args: unknown[]) => {
      // Record the count/head select distinctly — it is the registration probe.
      call.ops.push(op === 'select' && typeof args[1] === 'object' ? 'select:count' : op)
      return obj
    }
  }
  obj.single = () => Promise.resolve(resolve(call))
  obj.maybeSingle = () => Promise.resolve(resolve(call))
  obj.then = (ok: (v: Result) => void, bad: (e: unknown) => void) =>
    Promise.resolve(resolve(call)).then(ok, bad)
  return obj
}

const mockAuth = vi.fn()
const mockCreateServiceClient = vi.fn()
const mockRpc = vi.fn()
const mockNotifyCancellation = vi.fn()

vi.mock('@clerk/nextjs/server', () => ({ auth: () => mockAuth() }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => mockCreateServiceClient() }))
vi.mock('@/lib/notifications/guest-event-changes', () => ({
  diffEventFields: () => [],
  notifyGuestsOfEventUpdate: vi.fn(),
  notifyGuestsOfEventCancellation: (...args: unknown[]) => mockNotifyCancellation(...args),
}))

beforeEach(() => {
  issued.length = 0
  mockAuth.mockReset()
  mockCreateServiceClient.mockReset()
  mockRpc.mockReset()
  mockNotifyCancellation.mockReset()
})

/** Admin caller whose event has `registrations` rows; RPC returns `rpcDeleted`. */
function mockSupabase(registrations: number, rpcDeleted = registrations): SupabaseClient {
  return {
    from: (table: string) =>
      chainable(table, call => {
        if (table === 'profiles') return { data: { id: 'p_admin', role: 'admin' }, error: null }
        if (table === 'calendar_events' && call.ops.includes('delete')) return { error: null }
        if (table === 'calendar_events') return { data: { title: 'Tuesday session' }, error: null }
        if (call.ops.includes('select:count')) return { count: registrations, error: null }
        // The notify fetch: active registrants.
        return {
          data: Array.from({ length: registrations }, (_, i) => ({
            email: `g${i}@example.com`,
            name: `Guest ${i}`,
            lang: 'en',
          })),
          error: null,
        }
      }),
    rpc: mockRpc.mockResolvedValue({ data: rpcDeleted, error: null }),
  } as unknown as SupabaseClient
}

const params = Promise.resolve({ id: 'ev_1' })
const req = (query = '') =>
  new Request(`http://localhost/api/admin/calendar/ev_1${query}`, { method: 'DELETE' })

/** Did any chain issue a bare table delete? */
const bareDeleteIssued = () => issued.some(c => c.ops.includes('delete'))

describe('DELETE /api/admin/calendar/[id]', () => {
  it('returns 401 when unauthenticated and touches nothing', async () => {
    mockAuth.mockResolvedValue({ userId: null })
    const { DELETE } = await import('@/app/api/admin/calendar/[id]/route')

    const res = await DELETE(req(), { params })
    expect(res.status).toBe(401)
    expect(bareDeleteIssued()).toBe(false)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('returns 403 for a non-admin caller and touches nothing', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_member' })
    mockCreateServiceClient.mockReturnValue({
      from: () => chainable('profiles', () => ({ data: { id: 'p_m', role: 'member' }, error: null })),
      rpc: mockRpc,
    } as unknown as SupabaseClient)
    const { DELETE } = await import('@/app/api/admin/calendar/[id]/route')

    const res = await DELETE(req(), { params })
    expect(res.status).toBe(403)
    expect(bareDeleteIssued()).toBe(false)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('refuses with 409 and the count when the event has registrations', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_admin' })
    mockCreateServiceClient.mockReturnValue(mockSupabase(3))
    const { DELETE } = await import('@/app/api/admin/calendar/[id]/route')

    const res = await DELETE(req(), { params })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.registrationCount).toBe(3)
    expect(body.requiresConfirmation).toBe(true)
    // The refusal is the whole point: nothing was deleted, nobody was emailed.
    expect(bareDeleteIssued()).toBe(false)
    expect(mockRpc).not.toHaveBeenCalled()
    expect(mockNotifyCancellation).not.toHaveBeenCalled()
  })

  it('counts cancelled registrations too — they are kept for stats', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_admin' })
    // No ACTIVE registrants to notify, but one cancelled row still exists, so
    // the FK would refuse. The count query is unfiltered on cancelled_at.
    mockCreateServiceClient.mockReturnValue({
      from: (table: string) =>
        chainable(table, call => {
          if (table === 'profiles') return { data: { id: 'p_admin', role: 'admin' }, error: null }
          if (call.ops.includes('select:count')) return { count: 1, error: null }
          if (table === 'calendar_events') return { data: { title: 'Old session' }, error: null }
          return { data: [], error: null }
        }),
      rpc: mockRpc,
    } as unknown as SupabaseClient)
    const { DELETE } = await import('@/app/api/admin/calendar/[id]/route')

    const res = await DELETE(req(), { params })
    expect(res.status).toBe(409)
    expect((await res.json()).registrationCount).toBe(1)
  })

  it('deletes through the atomic RPC when the admin confirms', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_admin' })
    mockCreateServiceClient.mockReturnValue(mockSupabase(2))
    const { DELETE } = await import('@/app/api/admin/calendar/[id]/route')

    const res = await DELETE(req('?deleteRegistrations=true'), { params })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ deleted: true, registrationsDeleted: 2 })
    expect(mockRpc).toHaveBeenCalledWith('admin_delete_event_with_registrations', { p_event_id: 'ev_1' })
    // A bare delete here would destroy the registrations outside a transaction.
    expect(bareDeleteIssued()).toBe(false)
    expect(mockNotifyCancellation).toHaveBeenCalledTimes(1)
  })

  it('uses the plain delete and no RPC when the event has no registrations', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_admin' })
    mockCreateServiceClient.mockReturnValue(mockSupabase(0))
    const { DELETE } = await import('@/app/api/admin/calendar/[id]/route')

    const res = await DELETE(req(), { params })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ deleted: true, registrationsDeleted: 0 })
    expect(bareDeleteIssued()).toBe(true)
    expect(mockRpc).not.toHaveBeenCalled()
    expect(mockNotifyCancellation).not.toHaveBeenCalled()
  })

  it('ignores a confirmation that is not exactly true', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_admin' })
    mockCreateServiceClient.mockReturnValue(mockSupabase(1))
    const { DELETE } = await import('@/app/api/admin/calendar/[id]/route')

    const res = await DELETE(req('?deleteRegistrations=1'), { params })
    expect(res.status).toBe(409)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('surfaces a failed count as 500 rather than deleting blind', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_admin' })
    mockCreateServiceClient.mockReturnValue({
      from: (table: string) =>
        chainable(table, call => {
          if (table === 'profiles') return { data: { id: 'p_admin', role: 'admin' }, error: null }
          if (call.ops.includes('select:count')) return { count: null, error: { message: 'count failed' } }
          return { data: null, error: null }
        }),
      rpc: mockRpc,
    } as unknown as SupabaseClient)
    const { DELETE } = await import('@/app/api/admin/calendar/[id]/route')

    const res = await DELETE(req('?deleteRegistrations=true'), { params })
    expect(res.status).toBe(500)
    expect(bareDeleteIssued()).toBe(false)
    expect(mockRpc).not.toHaveBeenCalled()
  })
})
