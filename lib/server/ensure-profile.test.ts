import { beforeEach, describe, expect, it, vi } from 'vitest'

// Unit coverage for ensureProfile (self-heal of a missing `profiles` row):
//  - existing row is returned without an upsert
//  - a missing row is created from Clerk currentUser(), defaulting to 'guest'
//  - Clerk public_metadata.role seeds a higher role (no forced downgrade)
//  - a real DB read error (not "no rows") propagates rather than healing

// -- Seams --------------------------------------------------------------------

const mockCreateServiceClient = vi.fn()
const mockCurrentUser = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => mockCreateServiceClient(),
}))
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  currentUser: () => mockCurrentUser(),
}))

import { ensureProfile, buildProfileRow } from './ensure-profile'

// -- Supabase mock ------------------------------------------------------------

type ReadResult = { data: unknown; error: { code: string } | null }

/**
 * Minimal profiles-table stub. `read` is what select().eq().single() resolves
 * to; the upsert path records its argument and returns the built row back.
 */
function buildClient(read: ReadResult) {
  const upsertSpy = vi.fn(
    (row: Record<string, unknown>, _opts?: { onConflict?: string }) => ({
      select: () => ({
        single: () => Promise.resolve({ data: { id: 'new-id', ...row }, error: null }),
      }),
    })
  )

  const client = {
    from: (table: string) => {
      if (table !== 'profiles') throw new Error(`unexpected table ${table}`)
      return {
        select: () => ({
          eq: () => ({ single: () => Promise.resolve(read) }),
        }),
        upsert: upsertSpy,
      }
    },
  }
  return { client, upsertSpy }
}

const NO_ROW: ReadResult = { data: null, error: { code: 'PGRST116' } }

beforeEach(() => {
  vi.clearAllMocks()
  mockCurrentUser.mockResolvedValue({
    firstName: 'Ada',
    lastName: 'Lovelace',
    publicMetadata: {},
  })
})

describe('buildProfileRow', () => {
  it('defaults role to guest and derives display_names', () => {
    const row = buildProfileRow({ clerkId: 'u1', firstName: 'Ada', lastName: 'Lovelace' })
    expect(row).toMatchObject({
      clerk_id: 'u1',
      first_name: 'Ada',
      last_name: 'Lovelace',
      role: 'guest',
      abo_number: null,
      display_names: { en: 'Ada Lovelace' },
    })
  })

  it('passes through an explicit role', () => {
    expect(buildProfileRow({ clerkId: 'u1', role: 'member' }).role).toBe('member')
  })
})

describe('ensureProfile', () => {
  it('returns an existing row without upserting', async () => {
    const existing = { id: 'p1', clerk_id: 'user_existing', role: 'member' }
    const { client, upsertSpy } = buildClient({ data: existing, error: null })
    mockCreateServiceClient.mockReturnValue(client)

    const result = await ensureProfile('user_existing')

    expect(result).toEqual(existing)
    expect(upsertSpy).not.toHaveBeenCalled()
    expect(mockCurrentUser).not.toHaveBeenCalled()
  })

  it('creates a guest row from Clerk data when none exists', async () => {
    const { client, upsertSpy } = buildClient(NO_ROW)
    mockCreateServiceClient.mockReturnValue(client)

    const result = await ensureProfile('user_new_guest')

    expect(upsertSpy).toHaveBeenCalledTimes(1)
    const [row, opts] = upsertSpy.mock.calls[0]
    expect(row).toMatchObject({
      clerk_id: 'user_new_guest',
      first_name: 'Ada',
      last_name: 'Lovelace',
      role: 'guest',
      display_names: { en: 'Ada Lovelace' },
    })
    expect(opts).toEqual({ onConflict: 'clerk_id' })
    expect(result).toMatchObject({ id: 'new-id', role: 'guest' })
  })

  it('honors public_metadata.role when creating (no forced downgrade)', async () => {
    mockCurrentUser.mockResolvedValue({
      firstName: 'Grace',
      lastName: 'Hopper',
      publicMetadata: { role: 'core', abo_number: '12345' },
    })
    const { client, upsertSpy } = buildClient(NO_ROW)
    mockCreateServiceClient.mockReturnValue(client)

    await ensureProfile('user_new_core')

    expect(upsertSpy.mock.calls[0][0]).toMatchObject({
      role: 'core',
      abo_number: '12345',
    })
  })

  it('propagates a real read error instead of healing', async () => {
    const { client, upsertSpy } = buildClient({
      data: null,
      error: { code: '08006' }, // connection failure, not "no rows"
    })
    mockCreateServiceClient.mockReturnValue(client)

    await expect(ensureProfile('user_db_down')).rejects.toMatchObject({ code: '08006' })
    expect(upsertSpy).not.toHaveBeenCalled()
  })
})
