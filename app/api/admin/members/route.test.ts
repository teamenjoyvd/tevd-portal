import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// Regression coverage for #690: the route's second `profiles` query
// (manual_members_no_abo) was never built, so the key was silently absent
// from the response. Extends the chainable-mock template from
// app/api/admin/members/[id]/route.test.ts with the .is/.in/.not passthroughs
// that template lacked, and routes `profiles` results by call order since
// this route queries `profiles` three times (admin guard, LOS-linked,
// manual no-ABO) with different filters each time.

type QueryResult = { data: unknown; error: { message: string } | null }

function chainable(result: QueryResult): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  const passthrough = () => vi.fn(() => obj)
  obj.select = passthrough()
  obj.eq = passthrough()
  obj.order = passthrough()
  obj.not = passthrough()
  obj.in = passthrough()
  obj.is = passthrough()
  obj.single = () => Promise.resolve(result)
  obj.then = (resolve: (v: QueryResult) => void, reject: (e: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject)
  return obj
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

/**
 * `profiles` is queried three times in order: admin guard (`.eq().single()`),
 * LOS-linked profiles (`.not()`), manual no-ABO profiles (`.in().is()`).
 * `profilesResults` supplies results for each call in that order.
 */
function mockSupabase(
  losResult: QueryResult,
  profilesResults: QueryResult[]
): { client: SupabaseClient; profilesBuilders: Record<string, unknown>[] } {
  let callIndex = 0
  const profilesBuilders: Record<string, unknown>[] = []
  const from = (table: string) => {
    if (table === 'los_members') return chainable(losResult)
    if (table === 'profiles') {
      const result = profilesResults[callIndex] ?? profilesResults[profilesResults.length - 1]
      callIndex++
      const builder = chainable(result)
      profilesBuilders.push(builder)
      return builder
    }
    throw new Error(`unexpected table: ${table}`)
  }
  return { client: { from } as unknown as SupabaseClient, profilesBuilders }
}

const adminGuard: QueryResult = { data: { id: 'p_admin', role: 'admin' }, error: null }
const memberGuard: QueryResult = { data: { id: 'p_member', role: 'member' }, error: null }
const emptyLos: QueryResult = { data: [], error: null }

describe('GET /api/admin/members', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null })
    const { GET } = await import('@/app/api/admin/members/route')

    const res = await GET()
    expect(res.status).toBe(401)
    expect(mockCreateServiceClient).not.toHaveBeenCalled()
  })

  it('returns 403 for a non-admin caller', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_member' })
    const { client } = mockSupabase(emptyLos, [memberGuard])
    mockCreateServiceClient.mockReturnValue(client)
    const { GET } = await import('@/app/api/admin/members/route')

    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('admin response carries both keys, with the ABO-less query role- and null-filtered', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_admin' })
    const manualResult: QueryResult = {
      data: [{ id: 'p_coowner', first_name: 'Jo', last_name: 'Co', upline_abo_number: '123' }],
      error: null,
    }
    const abolinkedResult: QueryResult = { data: [], error: null }
    const { client, profilesBuilders } = mockSupabase(emptyLos, [
      adminGuard,
      abolinkedResult,
      manualResult,
    ])
    mockCreateServiceClient.mockReturnValue(client)
    const { GET } = await import('@/app/api/admin/members/route')

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      los_members: [],
      manual_members_no_abo: manualResult.data,
    })

    const manualBuilder = profilesBuilders[2]
    expect(manualBuilder.in).toHaveBeenCalledWith('role', ['member', 'core'])
    expect(manualBuilder.is).toHaveBeenCalledWith('abo_number', null)
  })
})
