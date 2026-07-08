import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// Route-level template for a payment-mutation endpoint (issue #484, remediation
// priority #3). Mocks Clerk `auth()` and `createServiceClient()` — the same two
// seams every protected route depends on — so the route's own auth/role/
// validation branches run for real against a fake DB.

type QueryResult = { data: unknown; error: { message: string } | null }

/** A chainable, thenable stand-in for a PostgREST query builder. Every
 * chain method (select/eq/order/insert/update/limit) returns the same
 * object; `.single()` and awaiting the object directly both resolve to
 * the fixed `result` for that table. */
function chainable(result: QueryResult): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  const passthrough = () => () => obj
  obj.select = passthrough()
  obj.eq = passthrough()
  obj.order = passthrough()
  obj.update = passthrough()
  obj.limit = passthrough()
  obj.insert = vi.fn(() => obj)
  obj.maybeSingle = () => Promise.resolve(result)
  obj.single = () => Promise.resolve(result)
  obj.then = (resolve: (v: QueryResult) => void, reject: (e: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject)
  return obj
}

function mockSupabase(routes: Record<string, QueryResult>): SupabaseClient {
  return {
    from: (table: string) => chainable(routes[table]),
  } as unknown as SupabaseClient
}

const mockAuth = vi.fn()
const mockCreateServiceClient = vi.fn()

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => mockCreateServiceClient(),
}))

beforeEach(() => {
  mockAuth.mockReset()
  mockCreateServiceClient.mockReset()
})

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/payments', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/payments', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null })
    const { POST } = await import('@/app/api/payments/route')

    const res = await POST(postReq({}))
    expect(res.status).toBe(401)
  })

  it('returns 404 when no profile exists for the caller', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    mockCreateServiceClient.mockReturnValue(
      mockSupabase({ profiles: { data: null, error: null } })
    )
    const { POST } = await import('@/app/api/payments/route')

    const res = await POST(postReq({ amount: 10, transaction_date: '2026-07-01', trip_id: 't1' }))
    expect(res.status).toBe(404)
  })

  it('returns 403 for a guest-role caller', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    mockCreateServiceClient.mockReturnValue(
      mockSupabase({ profiles: { data: { id: 'p1', role: 'guest' }, error: null } })
    )
    const { POST } = await import('@/app/api/payments/route')

    const res = await POST(postReq({ amount: 10, transaction_date: '2026-07-01', trip_id: 't1' }))
    expect(res.status).toBe(403)
  })

  it('returns 400 when amount/transaction_date are missing', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    mockCreateServiceClient.mockReturnValue(
      mockSupabase({ profiles: { data: { id: 'p1', role: 'member' }, error: null } })
    )
    const { POST } = await import('@/app/api/payments/route')

    const res = await POST(postReq({ trip_id: 't1' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when both trip_id and payable_item_id are provided', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    mockCreateServiceClient.mockReturnValue(
      mockSupabase({ profiles: { data: { id: 'p1', role: 'member' }, error: null } })
    )
    const { POST } = await import('@/app/api/payments/route')

    const res = await POST(
      postReq({ amount: 10, transaction_date: '2026-07-01', trip_id: 't1', payable_item_id: 'i1' })
    )
    expect(res.status).toBe(400)
  })

  it('returns 404 when payable_item_id does not resolve to an active item', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    mockCreateServiceClient.mockReturnValue(
      mockSupabase({
        profiles: { data: { id: 'p1', role: 'member' }, error: null },
        payable_items: { data: null, error: null },
      })
    )
    const { POST } = await import('@/app/api/payments/route')

    const res = await POST(
      postReq({ amount: 10, transaction_date: '2026-07-01', payable_item_id: 'i1' })
    )
    expect(res.status).toBe(404)
  })

  it('inserts a payment for a valid member-role request (201)', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    const insertedRow = { id: 'pay_1', amount: 10, profile_id: 'p1' }
    const supabase = mockSupabase({
      profiles: { data: { id: 'p1', role: 'member' }, error: null },
      payments: { data: insertedRow, error: null },
    })
    mockCreateServiceClient.mockReturnValue(supabase)
    const { POST } = await import('@/app/api/payments/route')

    const res = await POST(
      postReq({ amount: 10, transaction_date: '2026-07-01', trip_id: 't1', currency: 'EUR' })
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toEqual(insertedRow)
  })
})
