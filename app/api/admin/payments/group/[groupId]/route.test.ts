import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// Whole-group approve/reject for on-behalf payments (2607-DEV-676), plus the
// 409 guard that makes partial resolution impossible on the single-row route.
// Same two seams as the sibling route tests: Clerk `auth()` and
// `createServiceClient()`. The email layer is mocked at its dynamic-import
// boundary so A8 can count sends.

type QueryResult = { data: unknown; error: { message: string } | null }

const mockAuth = vi.fn()
const mockCreateServiceClient = vi.fn()
const mockSendNotificationEmail = vi.fn()

vi.mock('@clerk/nextjs/server', () => ({ auth: () => mockAuth() }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => mockCreateServiceClient() }))
vi.mock('@/lib/email/send', () => ({ sendNotificationEmail: (...a: unknown[]) => mockSendNotificationEmail(...a) }))
vi.mock('@/lib/email/templates/render', () => ({ renderEmailTemplate: () => Promise.resolve('<html/>') }))
vi.mock('@/lib/email/templates/PaymentStatusEmail', () => ({ PaymentStatusEmail: (p: unknown) => p }))

beforeEach(() => {
  mockAuth.mockReset()
  mockCreateServiceClient.mockReset()
  mockSendNotificationEmail.mockReset()
  mockSendNotificationEmail.mockResolvedValue(undefined)
})

function chainable(result: QueryResult): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  const passthrough = () => () => obj
  obj.select = passthrough()
  obj.eq = passthrough()
  obj.update = passthrough()
  obj.delete = passthrough()
  obj.single = () => Promise.resolve(result)
  obj.then = (resolve: (v: QueryResult) => void, reject: (e: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject)
  return obj
}

function mockSupabase(routes: Record<string, QueryResult>): SupabaseClient {
  const builders = new Map<string, Record<string, unknown>>()
  return {
    from: (table: string) => {
      const existing = builders.get(table)
      if (existing) return existing
      const built = chainable(routes[table])
      builders.set(table, built)
      return built
    },
  } as unknown as SupabaseClient
}

const ADMIN = { data: { id: 'admin_1', role: 'admin' }, error: null }

/** Two beneficiaries; the payer p1 is also the owner of the first row. */
const GROUP_ROWS = [
  {
    id: 'pay_1', amount: 100, currency: 'EUR', transaction_date: '2026-07-01',
    profile_id: 'p1', paid_by_profile_id: 'p1',
    beneficiary: { first_name: 'Pay', contact_email: 'payer@example.com' },
    payer: { first_name: 'Pay', contact_email: 'payer@example.com' },
    trips: { title: 'Trip' }, payable_items: null,
  },
  {
    id: 'pay_2', amount: 100, currency: 'EUR', transaction_date: '2026-07-01',
    profile_id: 'p2', paid_by_profile_id: 'p1',
    beneficiary: { first_name: 'Spouse', contact_email: 'spouse@example.com' },
    payer: { first_name: 'Pay', contact_email: 'payer@example.com' },
    trips: { title: 'Trip' }, payable_items: null,
  },
]

const params = (groupId: string) => ({ params: Promise.resolve({ groupId }) })
const patchReq = (body: unknown) =>
  new Request('http://localhost', { method: 'PATCH', body: JSON.stringify(body) })

/** The dynamic import chain in the route resolves across several microtasks. */
const flush = () => new Promise((r) => setTimeout(r, 0))

describe('PATCH /api/admin/payments/group/[groupId]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null })
    const { PATCH } = await import('@/app/api/admin/payments/group/[groupId]/route')

    const res = await PATCH(patchReq({ admin_status: 'approved' }), params('g1'))
    expect(res.status).toBe(401)
  })

  it('returns 403 for a non-admin caller', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    mockCreateServiceClient.mockReturnValue(
      mockSupabase({ profiles: { data: { id: 'p9', role: 'member' }, error: null } }),
    )
    const { PATCH } = await import('@/app/api/admin/payments/group/[groupId]/route')

    const res = await PATCH(patchReq({ admin_status: 'approved' }), params('g1'))
    expect(res.status).toBe(403)
  })

  it('rejects an admin_status outside approved/rejected', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    mockCreateServiceClient.mockReturnValue(mockSupabase({ profiles: ADMIN }))
    const { PATCH } = await import('@/app/api/admin/payments/group/[groupId]/route')

    const res = await PATCH(patchReq({ admin_status: 'withdrawn' }), params('g1'))
    expect(res.status).toBe(400)
  })

  it('404s when the group id matches no rows', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    mockCreateServiceClient.mockReturnValue(
      mockSupabase({ profiles: ADMIN, payments: { data: [], error: null } }),
    )
    const { PATCH } = await import('@/app/api/admin/payments/group/[groupId]/route')

    const res = await PATCH(patchReq({ admin_status: 'approved' }), params('g1'))
    expect(res.status).toBe(404)
  })

  it('A8: rejecting a group rejects all N rows and sends exactly ONE email, to the payer', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    mockCreateServiceClient.mockReturnValue(
      mockSupabase({ profiles: ADMIN, payments: { data: GROUP_ROWS, error: null } }),
    )
    const { PATCH } = await import('@/app/api/admin/payments/group/[groupId]/route')

    const res = await PATCH(patchReq({ admin_status: 'rejected', admin_note: 'wrong amount' }), params('g1'))
    await flush()

    expect(res.status).toBe(200)
    expect((await res.json()).updated).toBe(2)
    expect(mockSendNotificationEmail).toHaveBeenCalledTimes(1)
    expect(mockSendNotificationEmail.mock.calls[0][0].to).toBe('payer@example.com')
  })

  it('on approval notifies each beneficiary but not the payer about their own row', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    mockCreateServiceClient.mockReturnValue(
      mockSupabase({ profiles: ADMIN, payments: { data: GROUP_ROWS, error: null } }),
    )
    const { PATCH } = await import('@/app/api/admin/payments/group/[groupId]/route')

    const res = await PATCH(patchReq({ admin_status: 'approved' }), params('g1'))
    await flush()

    expect(res.status).toBe(200)
    expect(mockSendNotificationEmail).toHaveBeenCalledTimes(1)
    expect(mockSendNotificationEmail.mock.calls[0][0].to).toBe('spouse@example.com')
  })
})

describe('A7: PATCH/DELETE /api/admin/payments/[id] on a grouped row', () => {
  it('409s on PATCH rather than approving half a group', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    mockCreateServiceClient.mockReturnValue(
      mockSupabase({ profiles: ADMIN, payments: { data: { payment_group_id: 'g1' }, error: null } }),
    )
    const { PATCH } = await import('@/app/api/admin/payments/[id]/route')

    const res = await PATCH(patchReq({ admin_status: 'approved' }), { params: Promise.resolve({ id: 'pay_2' }) })
    expect(res.status).toBe(409)
  })

  it('409s on DELETE rather than orphaning the rest of the group', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    mockCreateServiceClient.mockReturnValue(
      mockSupabase({ profiles: ADMIN, payments: { data: { payment_group_id: 'g1' }, error: null } }),
    )
    const { DELETE } = await import('@/app/api/admin/payments/[id]/route')

    const res = await DELETE(new Request('http://localhost'), { params: Promise.resolve({ id: 'pay_2' }) })
    expect(res.status).toBe(409)
  })

  it('leaves the legacy single-row path alone when payment_group_id is null', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    mockCreateServiceClient.mockReturnValue(
      mockSupabase({ profiles: ADMIN, payments: { data: { payment_group_id: null }, error: null } }),
    )
    const { DELETE } = await import('@/app/api/admin/payments/[id]/route')

    const res = await DELETE(new Request('http://localhost'), { params: Promise.resolve({ id: 'pay_9' }) })
    expect(res.status).toBe(204)
  })
})
