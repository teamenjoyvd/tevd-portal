import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// Route-level template for an admin-mutation endpoint (issue #484, remediation
// priority #3), chosen specifically because its role-patch branch calls the
// `patch_member_role` RPC guarded by the #476 fix
// (supabase/migrations/20260707120000_guard_patch_member_role.sql). This test
// asserts the app layer's own admin guard (getCallerContext) gates that RPC
// call — i.e. a non-admin caller never reaches the guarded RPC at all — which
// is the defense-in-depth half of the #476 regression the migration-SQL test
// (supabase/migrations/rpc-guards.test.ts) covers on the database side.

type QueryResult = { data: unknown; error: { message: string } | null }

function chainable(result: QueryResult): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  const passthrough = () => () => obj
  obj.select = passthrough()
  obj.eq = passthrough()
  obj.order = passthrough()
  obj.update = passthrough()
  obj.limit = passthrough()
  obj.insert = passthrough()
  obj.maybeSingle = () => Promise.resolve(result)
  obj.single = () => Promise.resolve(result)
  obj.then = (resolve: (v: QueryResult) => void, reject: (e: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject)
  return obj
}

const mockAuth = vi.fn()
const mockClerkClient = vi.fn()
const mockCreateServiceClient = vi.fn()
const mockRpc = vi.fn()
const mockUpdateUserMetadata = vi.fn()

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
  clerkClient: () => mockClerkClient(),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => mockCreateServiceClient(),
}))

beforeEach(() => {
  mockAuth.mockReset()
  mockClerkClient.mockReset()
  mockCreateServiceClient.mockReset()
  mockRpc.mockReset()
  mockUpdateUserMetadata.mockReset()
  mockClerkClient.mockResolvedValue({ users: { updateUserMetadata: mockUpdateUserMetadata } })
})

function mockSupabase(routes: Record<string, QueryResult>, rpcResult: QueryResult): SupabaseClient {
  return {
    from: (table: string) => chainable(routes[table]),
    rpc: mockRpc.mockReturnValue(Promise.resolve(rpcResult)),
  } as unknown as SupabaseClient
}

function patchReq(body: unknown): Request {
  return new Request('http://localhost/api/admin/members/target_1', {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

const params = Promise.resolve({ id: 'target_1' })

describe('PATCH /api/admin/members/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null })
    const { PATCH } = await import('@/app/api/admin/members/[id]/route')

    const res = await PATCH(patchReq({ role: 'admin' }), { params })
    expect(res.status).toBe(401)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('returns 403 for a non-admin (member) caller and never reaches the guarded RPC', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_member' })
    mockCreateServiceClient.mockReturnValue(
      mockSupabase({ profiles: { data: { id: 'p_member', role: 'member' }, error: null } }, { data: [], error: null })
    )
    const { PATCH } = await import('@/app/api/admin/members/[id]/route')

    const res = await PATCH(patchReq({ role: 'admin' }), { params })
    expect(res.status).toBe(403)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('returns 403 for a non-admin (core) caller and never reaches the guarded RPC', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_core' })
    mockCreateServiceClient.mockReturnValue(
      mockSupabase({ profiles: { data: { id: 'p_core', role: 'core' }, error: null } }, { data: [], error: null })
    )
    const { PATCH } = await import('@/app/api/admin/members/[id]/route')

    const res = await PATCH(patchReq({ role: 'admin' }), { params })
    expect(res.status).toBe(403)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('admin caller: role patch reaches patch_member_role RPC and syncs Clerk metadata', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_admin' })
    const updatedRow = { id: 'target_1', role: 'member', clerk_id: 'clerk_target' }
    mockCreateServiceClient.mockReturnValue(
      mockSupabase(
        { profiles: { data: { id: 'p_admin', role: 'admin' }, error: null } },
        { data: [updatedRow], error: null }
      )
    )
    const { PATCH } = await import('@/app/api/admin/members/[id]/route')

    const res = await PATCH(patchReq({ role: 'member' }), { params })

    expect(mockRpc).toHaveBeenCalledWith('patch_member_role', {
      p_profile_id: 'target_1',
      p_new_role: 'member',
      p_changed_by: 'clerk_admin',
    })
    expect(mockUpdateUserMetadata).toHaveBeenCalledWith('clerk_target', {
      publicMetadata: { role: 'member' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ id: 'target_1', role: 'member', clerk_id: 'clerk_target' })
  })
})
