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
  obj.or = passthrough()
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

function mockSupabase(
  routes: Record<string, QueryResult>,
  rpcs: Record<string, QueryResult> = {},
): SupabaseClient {
  // One builder per table, memoized: a fresh object per `from()` call would give
  // every assertion its own pristine `insert` spy, so `not.toHaveBeenCalledWith`
  // would pass vacuously no matter what the route did.
  const builders = new Map<string, Record<string, unknown>>()
  return {
    from: (table: string) => {
      const existing = builders.get(table)
      if (existing) return existing
      const built = chainable(routes[table])
      builders.set(table, built)
      return built
    },
    rpc: vi.fn((name: string) => Promise.resolve(rpcs[name] ?? { data: null, error: null })),
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

// ── Proof-path binding (2607-DEV-676 security follow-up) ─────────────────────

describe('POST /api/payments — proof_url ownership', () => {
  it('A10: rejects a proof_url under another profile prefix with 400 and no insert', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    const supabase = mockSupabase({
      profiles: { data: { id: 'p1', role: 'member' }, error: null },
      payments: { data: { id: 'pay_1' }, error: null },
    })
    mockCreateServiceClient.mockReturnValue(supabase)
    const { POST } = await import('@/app/api/payments/route')

    const res = await POST(
      postReq({
        amount: 10,
        transaction_date: '2026-07-01',
        trip_id: 't1',
        proof_url: 'p2/alice-bank-statement.jpg',
      }),
    )

    expect(res.status).toBe(400)
    const insert = (supabase.from('payments') as unknown as { insert: ReturnType<typeof vi.fn> }).insert
    expect(insert).not.toHaveBeenCalled()
  })

  it('A11: accepts a proof_url under the caller own prefix and stores it', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    const supabase = mockSupabase({
      profiles: { data: { id: 'p1', role: 'member' }, error: null },
      payments: { data: { id: 'pay_1' }, error: null },
    })
    mockCreateServiceClient.mockReturnValue(supabase)
    const { POST } = await import('@/app/api/payments/route')

    const res = await POST(
      postReq({
        amount: 10,
        transaction_date: '2026-07-01',
        trip_id: 't1',
        proof_url: 'p1/mine.jpg',
      }),
    )

    expect(res.status).toBe(201)
    const insert = (supabase.from('payments') as unknown as { insert: ReturnType<typeof vi.fn> }).insert
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ proof_url: 'p1/mine.jpg' }))
  })

  it('A12: GET withholds the proof path from a beneficiary who did not pay', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    mockCreateServiceClient.mockReturnValue(
      mockSupabase({
        profiles: { data: { id: 'p1', role: 'member' }, error: null },
        payments: {
          data: [
            // Paid by me — I uploaded it, I keep it.
            { id: 'a', proof_url: 'p1/mine.jpg', profile_id: 'p1', paid_by_profile_id: null },
            // On my ledger, but my upline transferred the money and the image is
            // a screenshot of THEIR bank account.
            { id: 'b', proof_url: 'p9/their-bank.jpg', profile_id: 'p1', paid_by_profile_id: 'p9' },
          ],
          error: null,
        },
      }),
    )
    const { GET } = await import('@/app/api/payments/route')

    const body = await (await GET()).json()
    expect(body.find((r: { id: string }) => r.id === 'a').proof_url).toBe('p1/mine.jpg')
    expect(body.find((r: { id: string }) => r.id === 'b').proof_url).toBeNull()
  })
})

// ── On-behalf payment groups (2607-DEV-676) ──────────────────────────────────

/** The payer plus two people they are genuinely allowed to pay for. */
const ELIGIBLE = {
  data: [
    { profile_id: 'p1', first_name: 'Pay', last_name: 'Er', abo_number: '1', role: 'member', relation: 'self' },
    { profile_id: 'p2', first_name: 'Down', last_name: 'Line', abo_number: '2', role: 'member', relation: 'downline' },
    { profile_id: 'p3', first_name: 'Co', last_name: 'Owner', abo_number: null, role: 'member', relation: 'household' },
  ],
  error: null,
}

function groupSupabase(overrides: Record<string, QueryResult> = {}) {
  return mockSupabase(
    {
      profiles: { data: { id: 'p1', role: 'member' }, error: null },
      payments: {
        data: [
          { id: 'pay_1', profile_id: 'p1', paid_by_profile_id: 'p1', payment_group_id: 'g1', amount: 100 },
          { id: 'pay_2', profile_id: 'p2', paid_by_profile_id: 'p1', payment_group_id: 'g1', amount: 100 },
        ],
        error: null,
      },
      // The one ad-hoc guest this payer already knows (2607-DEV-677). Only
      // queried when a request actually names a guest, so the profile-only
      // tests above never touch it.
      payment_guests: {
        data: [{ id: 'gst_1', name: 'Ivan Petrov', email: 'ivan@example.com' }],
        error: null,
      },
      ...overrides,
    },
    {
      get_payable_beneficiaries: ELIGIBLE,
      submit_payment_group: { data: 'g1', error: null },
    },
  )
}

describe('POST /api/payments — beneficiary groups', () => {
  it('A1: a body with no beneficiaries key still takes the legacy single-row path', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    const supabase = mockSupabase({
      profiles: { data: { id: 'p1', role: 'member' }, error: null },
      payments: { data: { id: 'pay_1' }, error: null },
    })
    mockCreateServiceClient.mockReturnValue(supabase)
    const { POST } = await import('@/app/api/payments/route')

    const res = await POST(postReq({ amount: 10, transaction_date: '2026-07-01', trip_id: 't1' }))

    expect(res.status).toBe(201)
    // The regression proof: the legacy insert must carry neither new column,
    // so existing rows keep passing the both-or-neither CHECK.
    const insert = (supabase.from('payments') as unknown as { insert: ReturnType<typeof vi.fn> }).insert
    expect(insert).toHaveBeenCalled() // guards the two negative assertions below from passing vacuously
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(insert).not.toHaveBeenCalledWith(expect.objectContaining({ payment_group_id: expect.anything() }))
    expect(insert).not.toHaveBeenCalledWith(expect.objectContaining({ paid_by_profile_id: expect.anything() }))
  })

  it('A2: a valid group submits once and returns the group id with its rows', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    const supabase = groupSupabase()
    mockCreateServiceClient.mockReturnValue(supabase)
    const { POST } = await import('@/app/api/payments/route')

    const res = await POST(
      postReq({
        amount: 200,
        transaction_date: '2026-07-01',
        trip_id: 't1',
        beneficiaries: [
          { profile_id: 'p1', amount_cents: 10000 },
          { profile_id: 'p2', amount_cents: 10000 },
        ],
      }),
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.payment_group_id).toBe('g1')
    expect(body.payments).toHaveLength(2)

    // The group id is generated inside the RPC and never taken from the client.
    const call = (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === 'submit_payment_group',
    )
    expect(call?.[1].p_payer).toBe('p1')
    expect(call?.[1].p_payload.total_cents).toBe(20000)
    expect(call?.[1].p_payload).not.toHaveProperty('payment_group_id')
  })

  it('A3: a hand-crafted body naming an out-of-LOS profile_id is rejected with 403', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    const supabase = groupSupabase()
    mockCreateServiceClient.mockReturnValue(supabase)
    const { POST } = await import('@/app/api/payments/route')

    const res = await POST(
      postReq({
        amount: 200,
        transaction_date: '2026-07-01',
        trip_id: 't1',
        beneficiaries: [
          { profile_id: 'p1', amount_cents: 10000 },
          { profile_id: 'STRANGER', amount_cents: 10000 },
        ],
      }),
    )

    expect(res.status).toBe(403)
    // Rejected before any write is attempted.
    const calls = (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mock.calls
    expect(calls.some((c) => c[0] === 'submit_payment_group')).toBe(false)
  })

  it('A4: rows that do not sum to the total are rejected with 400', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    const supabase = groupSupabase()
    mockCreateServiceClient.mockReturnValue(supabase)
    const { POST } = await import('@/app/api/payments/route')

    const res = await POST(
      postReq({
        amount: 200,
        transaction_date: '2026-07-01',
        trip_id: 't1',
        beneficiaries: [
          { profile_id: 'p1', amount_cents: 10000 },
          { profile_id: 'p2', amount_cents: 9999 },
        ],
      }),
    )

    expect(res.status).toBe(400)
    const calls = (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mock.calls
    expect(calls.some((c) => c[0] === 'submit_payment_group')).toBe(false)
  })

  it('rejects a zero amount_cents explicitly rather than reading it as missing', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    mockCreateServiceClient.mockReturnValue(groupSupabase())
    const { POST } = await import('@/app/api/payments/route')

    const res = await POST(
      postReq({
        amount: 100,
        transaction_date: '2026-07-01',
        trip_id: 't1',
        beneficiaries: [{ profile_id: 'p1', amount_cents: 0 }],
      }),
    )
    expect(res.status).toBe(400)
  })

  it('rejects a duplicated beneficiary', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    mockCreateServiceClient.mockReturnValue(groupSupabase())
    const { POST } = await import('@/app/api/payments/route')

    const res = await POST(
      postReq({
        amount: 200,
        transaction_date: '2026-07-01',
        trip_id: 't1',
        beneficiaries: [
          { profile_id: 'p2', amount_cents: 10000 },
          { profile_id: 'p2', amount_cents: 10000 },
        ],
      }),
    )
    expect(res.status).toBe(400)
  })

  it('A9: a group submission carrying another profile proof path is rejected 400', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    const supabase = groupSupabase()
    mockCreateServiceClient.mockReturnValue(supabase)
    const { POST } = await import('@/app/api/payments/route')

    const res = await POST(
      postReq({
        amount: 100,
        transaction_date: '2026-07-01',
        trip_id: 't1',
        proof_url: 'SOMEONE_ELSE/bank.jpg',
        beneficiaries: [{ profile_id: 'p2', amount_cents: 10000 }],
      }),
    )

    expect(res.status).toBe(400)
    const calls = (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mock.calls
    expect(calls.some((c) => c[0] === 'submit_payment_group')).toBe(false)
  })

  it('maps a P0001 from the RPC to 403 — the in-transaction eligibility re-check', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    mockCreateServiceClient.mockReturnValue(
      mockSupabase(
        { profiles: { data: { id: 'p1', role: 'member' }, error: null } },
        {
          get_payable_beneficiaries: ELIGIBLE,
          submit_payment_group: {
            data: null,
            error: { message: 'profile p2 is not payable by p1', code: 'P0001' } as { message: string },
          },
        },
      ),
    )
    const { POST } = await import('@/app/api/payments/route')

    const res = await POST(
      postReq({
        amount: 100,
        transaction_date: '2026-07-01',
        trip_id: 't1',
        beneficiaries: [{ profile_id: 'p2', amount_cents: 10000 }],
      }),
    )
    expect(res.status).toBe(403)
  })
})

// Ad-hoc guests with no account (2607-DEV-677). The database-side rules are
// probed directly against DEV; what these cover is the ROUTE's own screening —
// what it forwards to submit_payment_group and what it refuses to.
describe('POST /api/payments — ad-hoc guests', () => {
  it('G1: an inline guest is forwarded as a guest entry, not a profile', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    const supabase = groupSupabase()
    mockCreateServiceClient.mockReturnValue(supabase)
    const { POST } = await import('@/app/api/payments/route')

    const res = await POST(
      postReq({
        amount: 200,
        transaction_date: '2026-07-01',
        trip_id: 't1',
        beneficiaries: [
          { profile_id: 'p1', amount_cents: 10000 },
          { guest: { name: '  Nadia Ivanova ', email: ' NADIA@example.com ' }, amount_cents: 10000 },
        ],
      }),
    )

    expect(res.status).toBe(201)
    const call = (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === 'submit_payment_group',
    )
    const entries = call?.[1].p_payload.beneficiaries
    // Trimmed but NOT case-folded: the stored value is what the payer typed and
    // is what the picker shows back to them. Case-insensitivity belongs to the
    // IDENTITY (guestIdentityKey / uq_payment_guests_owner_identity), which the
    // G6 collision case below proves.
    expect(entries[1].guest).toEqual({ name: 'Nadia Ivanova', email: 'NADIA@example.com' })
    // The entry carries ONE identifier: a stray profile_id riding along beside a
    // guest is what the rebuild in the route exists to prevent.
    expect(entries[1]).not.toHaveProperty('profile_id')
    expect(entries[1]).not.toHaveProperty('guest_id')
  })

  it('G2b: a remembered guest is submitted by id', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    const supabase = groupSupabase()
    mockCreateServiceClient.mockReturnValue(supabase)
    const { POST } = await import('@/app/api/payments/route')

    const res = await POST(
      postReq({
        amount: 50,
        transaction_date: '2026-07-01',
        trip_id: 't1',
        beneficiaries: [{ guest_id: 'gst_1', amount_cents: 5000 }],
      }),
    )

    expect(res.status).toBe(201)
    const call = (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === 'submit_payment_group',
    )
    expect(call?.[1].p_payload.beneficiaries[0]).toEqual({ guest_id: 'gst_1', amount_cents: 5000 })
  })

  it('G7: a guest_id belonging to someone else is rejected 403 and never submitted', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    const supabase = groupSupabase()
    mockCreateServiceClient.mockReturnValue(supabase)
    const { POST } = await import('@/app/api/payments/route')

    const res = await POST(
      postReq({
        amount: 50,
        transaction_date: '2026-07-01',
        trip_id: 't1',
        beneficiaries: [{ guest_id: 'gst_someone_else', amount_cents: 5000 }],
      }),
    )

    expect(res.status).toBe(403)
    const calls = (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mock.calls
    expect(calls.find((c) => c[0] === 'submit_payment_group')).toBeUndefined()
  })

  it('G6: the same guest named by id and re-typed inline collides with 400', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    mockCreateServiceClient.mockReturnValue(groupSupabase())
    const { POST } = await import('@/app/api/payments/route')

    const res = await POST(
      postReq({
        amount: 100,
        transaction_date: '2026-07-01',
        trip_id: 't1',
        beneficiaries: [
          { guest_id: 'gst_1', amount_cents: 5000 },
          // Same identity as gst_1 under the unique index: trimmed, case-folded.
          { guest: { name: ' ivan petrov ', email: 'IVAN@example.com' }, amount_cents: 5000 },
        ],
      }),
    )

    expect(res.status).toBe(400)
  })

  it('G8: an entry naming both a profile and a guest is rejected 400', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    mockCreateServiceClient.mockReturnValue(groupSupabase())
    const { POST } = await import('@/app/api/payments/route')

    const res = await POST(
      postReq({
        amount: 100,
        transaction_date: '2026-07-01',
        trip_id: 't1',
        beneficiaries: [{ profile_id: 'p1', guest_id: 'gst_1', amount_cents: 10000 }],
      }),
    )

    expect(res.status).toBe(400)
  })

  it('G9: a blank guest name is rejected 400', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' })
    mockCreateServiceClient.mockReturnValue(groupSupabase())
    const { POST } = await import('@/app/api/payments/route')

    const res = await POST(
      postReq({
        amount: 100,
        transaction_date: '2026-07-01',
        trip_id: 't1',
        beneficiaries: [{ guest: { name: '   ' }, amount_cents: 10000 }],
      }),
    )

    expect(res.status).toBe(400)
  })
})
