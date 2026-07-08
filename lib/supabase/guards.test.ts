import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCallerContext, requireAdmin, requireAdminOrCore } from '@/lib/supabase/guards'

/**
 * Builds a mock SupabaseClient whose `.from('profiles').select().eq().single()`
 * chain resolves to `{ data: profile, error: null }`. Mirrors the exact call
 * shape used by getCallerContext (lib/supabase/guards.ts) — a single round trip
 * against the `profiles` table filtered by `clerk_id`.
 */
function mockSupabaseWithProfile(profile: { id: string; role: string } | null): SupabaseClient {
  const single = () => Promise.resolve({ data: profile, error: null })
  const eq = () => ({ single })
  const select = () => ({ eq })
  const from = () => ({ select })
  return { from } as unknown as SupabaseClient
}

describe('getCallerContext', () => {
  it('admin caller requesting admin: allowed, guard is null', async () => {
    const supabase = mockSupabaseWithProfile({ id: 'p1', role: 'admin' })
    const ctx = await getCallerContext('clerk_1', supabase, 'admin')
    expect(ctx.guard).toBeNull()
    expect(ctx.profile).toEqual({ id: 'p1', role: 'admin' })
  })

  it('core caller requesting admin: forbidden (403)', async () => {
    const supabase = mockSupabaseWithProfile({ id: 'p2', role: 'core' })
    const ctx = await getCallerContext('clerk_2', supabase, 'admin')
    expect(ctx.profile).toBeNull()
    expect(ctx.guard).toBeInstanceOf(Response)
    expect(ctx.guard?.status).toBe(403)
    const body = await ctx.guard?.json()
    expect(body).toEqual({ error: 'Forbidden' })
  })

  it('core caller requesting adminOrCore: allowed', async () => {
    const supabase = mockSupabaseWithProfile({ id: 'p3', role: 'core' })
    const ctx = await getCallerContext('clerk_3', supabase, 'adminOrCore')
    expect(ctx.guard).toBeNull()
    expect(ctx.profile).toEqual({ id: 'p3', role: 'core' })
  })

  it('admin caller requesting adminOrCore: allowed', async () => {
    const supabase = mockSupabaseWithProfile({ id: 'p4', role: 'admin' })
    const ctx = await getCallerContext('clerk_4', supabase, 'adminOrCore')
    expect(ctx.guard).toBeNull()
  })

  it('member caller requesting adminOrCore: forbidden (403)', async () => {
    const supabase = mockSupabaseWithProfile({ id: 'p5', role: 'member' })
    const ctx = await getCallerContext('clerk_5', supabase, 'adminOrCore')
    expect(ctx.profile).toBeNull()
    expect(ctx.guard?.status).toBe(403)
  })

  it('member caller requesting admin: forbidden (403)', async () => {
    const supabase = mockSupabaseWithProfile({ id: 'p6', role: 'member' })
    const ctx = await getCallerContext('clerk_6', supabase, 'admin')
    expect(ctx.profile).toBeNull()
    expect(ctx.guard?.status).toBe(403)
  })

  it('no-profile caller (anonymous / unregistered clerk_id): forbidden (403)', async () => {
    const supabase = mockSupabaseWithProfile(null)
    const ctx = await getCallerContext('clerk_ghost', supabase, 'admin')
    expect(ctx.profile).toBeNull()
    expect(ctx.guard?.status).toBe(403)
  })

  it('no-profile caller requesting adminOrCore: forbidden (403)', async () => {
    const supabase = mockSupabaseWithProfile(null)
    const ctx = await getCallerContext('clerk_ghost', supabase, 'adminOrCore')
    expect(ctx.profile).toBeNull()
    expect(ctx.guard?.status).toBe(403)
  })
})

describe('requireAdmin (deprecated wrapper)', () => {
  it('returns null for an admin caller', async () => {
    const supabase = mockSupabaseWithProfile({ id: 'p1', role: 'admin' })
    const guard = await requireAdmin('clerk_1', supabase)
    expect(guard).toBeNull()
  })

  it('returns a 403 Response for a core caller', async () => {
    const supabase = mockSupabaseWithProfile({ id: 'p2', role: 'core' })
    const guard = await requireAdmin('clerk_2', supabase)
    expect(guard).toBeInstanceOf(Response)
    expect(guard?.status).toBe(403)
  })

  it('returns a 403 Response for a no-profile caller', async () => {
    const supabase = mockSupabaseWithProfile(null)
    const guard = await requireAdmin('clerk_ghost', supabase)
    expect(guard?.status).toBe(403)
  })
})

describe('requireAdminOrCore (deprecated wrapper)', () => {
  it('returns null for a core caller', async () => {
    const supabase = mockSupabaseWithProfile({ id: 'p3', role: 'core' })
    const guard = await requireAdminOrCore('clerk_3', supabase)
    expect(guard).toBeNull()
  })

  it('returns null for an admin caller', async () => {
    const supabase = mockSupabaseWithProfile({ id: 'p4', role: 'admin' })
    const guard = await requireAdminOrCore('clerk_4', supabase)
    expect(guard).toBeNull()
  })

  it('returns a 403 Response for a member caller', async () => {
    const supabase = mockSupabaseWithProfile({ id: 'p5', role: 'member' })
    const guard = await requireAdminOrCore('clerk_5', supabase)
    expect(guard?.status).toBe(403)
  })

  it('returns a 403 Response for a no-profile caller', async () => {
    const supabase = mockSupabaseWithProfile(null)
    const guard = await requireAdminOrCore('clerk_ghost', supabase)
    expect(guard?.status).toBe(403)
  })
})
