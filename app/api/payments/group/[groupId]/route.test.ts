import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// Withdraw of a whole on-behalf payment group (2607-DEV-676). Same two seams as
// app/api/payments/route.test.ts: Clerk `auth()` and `createServiceClient()`.

type QueryResult = { data: unknown; error: { message: string } | null; count?: number }

const mockAuth = vi.fn()
const mockCreateServiceClient = vi.fn()
const mockRemove = vi.fn()

vi.mock('@clerk/nextjs/server', () => ({ auth: () => mockAuth() }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => mockCreateServiceClient() }))

beforeEach(() => {
  mockAuth.mockReset()
  mockCreateServiceClient.mockReset()
  mockRemove.mockReset()
  mockRemove.mockResolvedValue({ error: null })
})

function chainable(result: QueryResult): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  const passthrough = () => () => obj
  obj.select = passthrough()
  obj.eq = passthrough()
  obj.single = () => Promise.resolve(result)
  obj.then = (resolve: (v: QueryResult) => void, reject: (e: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject)
  return obj
}

function mockSupabase(routes: Record<string, QueryResult>, withdrawResult: QueryResult): SupabaseClient {
  const builders = new Map<string, Record<string, unknown>>()
  return {
    from: (table: string) => {
      const existing = builders.get(table)
      if (existing) return existing
      const built = chainable(routes[table])
      builders.set(table, built)
      return built
    },
    rpc: vi.fn(() => Promise.resolve(withdrawResult)),
    storage: { from: () => ({ remove: mockRemove }) },
  } as unknown as SupabaseClient
}

const params = (groupId: string) => ({ params: Promise.resolve({ groupId }) })

describe('DELETE /api/payments/group/[groupId]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null })
    const { DELETE } = await import('@/app/api/payments/group/[groupId]/route')

    const res = await DELETE(new Request('http://localhost'), params('g1'))
    expect(res.status).toBe(401)
  })

  it('A5: withdrawing your own pending group returns 204 and removes the orphaned proof', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    mockCreateServiceClient.mockReturnValue(
      mockSupabase(
        {
          profiles: { data: { id: 'p1', role: 'member' }, error: null },
          // No row still references the proof object.
          payments: { data: null, error: null, count: 0 },
        },
        { data: [{ deleted: 2, proof_url: 'proofs/abc.png' }], error: null },
      ),
    )
    const { DELETE } = await import('@/app/api/payments/group/[groupId]/route')

    const res = await DELETE(new Request('http://localhost'), params('g1'))

    expect(res.status).toBe(204)
    expect(mockRemove).toHaveBeenCalledWith(['proofs/abc.png'])
  })

  it("A6: withdrawing someone else's or an already-approved group returns 404", async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    mockCreateServiceClient.mockReturnValue(
      mockSupabase(
        { profiles: { data: { id: 'p1', role: 'member' }, error: null } },
        // The RPC asserts ownership and pending-ness inside its DELETE ... WHERE,
        // so both cases come back identically as "nothing was deleted".
        { data: [{ deleted: 0, proof_url: null }], error: null },
      ),
    )
    const { DELETE } = await import('@/app/api/payments/group/[groupId]/route')

    const res = await DELETE(new Request('http://localhost'), params('g1'))

    expect(res.status).toBe(404)
    expect(mockRemove).not.toHaveBeenCalled()
  })

  it('keeps the proof object when another payment still references it', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    mockCreateServiceClient.mockReturnValue(
      mockSupabase(
        {
          profiles: { data: { id: 'p1', role: 'member' }, error: null },
          payments: { data: null, error: null, count: 1 },
        },
        { data: [{ deleted: 1, proof_url: 'proofs/shared.png' }], error: null },
      ),
    )
    const { DELETE } = await import('@/app/api/payments/group/[groupId]/route')

    const res = await DELETE(new Request('http://localhost'), params('g1'))

    expect(res.status).toBe(204)
    expect(mockRemove).not.toHaveBeenCalled()
  })

  it('still succeeds when storage removal fails — a withdraw is already committed', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    mockRemove.mockResolvedValue({ error: { message: 'storage down' } })
    mockCreateServiceClient.mockReturnValue(
      mockSupabase(
        {
          profiles: { data: { id: 'p1', role: 'member' }, error: null },
          payments: { data: null, error: null, count: 0 },
        },
        { data: [{ deleted: 2, proof_url: 'proofs/abc.png' }], error: null },
      ),
    )
    const { DELETE } = await import('@/app/api/payments/group/[groupId]/route')

    const res = await DELETE(new Request('http://localhost'), params('g1'))
    expect(res.status).toBe(204)
  })
})
