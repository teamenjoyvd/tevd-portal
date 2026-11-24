import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockAuth = vi.fn()
const mockUser = vi.fn()
const mockCreate = vi.fn()
const mockSlot = vi.fn()
let event: Record<string, unknown>
let admitted = 0
let inserted: Record<string, unknown>[]
let updates: Record<string, unknown>[]

const PRODUCT = '11111111-1111-4111-8111-111111111111'
const EVENT = '22222222-2222-4222-8222-222222222222'

vi.mock('@clerk/nextjs/server', () => ({ auth: () => mockAuth(), currentUser: () => mockUser() }))
vi.mock('@/lib/rate-limit', () => ({ consumeCheckoutSlot: (ip: string) => mockSlot(ip) }))
vi.mock('@/lib/utils/base-url', () => ({ getBaseUrl: async () => 'https://x.test' }))
vi.mock('@/lib/server/stripe/client', () => ({
  isStripeConfigured: () => true,
  getStripe: () => ({ checkout: { sessions: { create: (...a: unknown[]) => mockCreate(...a) } } }),
}))
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {}
      Object.assign(q, {
        select: () => q, eq: () => q, in: () => q,
        order: async () => ({
          data: [{ id: PRODUCT, kind: 'single', series_key: 'tuesday', event_id: null, price_cents: 500, entries: 1, validity_days: 60 }],
          error: null,
        }),
        maybeSingle: async () => ({ data: table === 'calendar_events' ? event : { id: 'profile1' }, error: null }),
        insert: (r: Record<string, unknown>) => (inserted.push(r), q),
        single: async () => ({ data: { id: 'order1' }, error: null }),
        update: (r: Record<string, unknown>) => (updates.push(r), q),
        then: (resolve: (v: unknown) => void) => resolve({ count: admitted, error: null }),
      })
      return q
    },
  }),
}))

const { POST } = await import('./route')
const body = { event_id: EVENT, product_id: PRODUCT, name: 'Ann Lee', email: 'ann@example.com' }
const post = (b: unknown) =>
  POST(new Request('http://x', { method: 'POST', body: JSON.stringify(b), headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } }))
const minutes = (n: number) => new Date(Date.now() + n * 60_000).toISOString()

beforeEach(() => {
  event = { id: EVENT, title: 'Tuesday', start_time: minutes(0), end_time: minutes(90), source: 'zoom', series_key: 'tuesday', in_person_capacity: 10, tickets_cancelled_at: null }
  admitted = 0
  inserted = []
  updates = []
  mockAuth.mockReset().mockResolvedValue({ userId: null })
  mockUser.mockReset().mockResolvedValue(null)
  mockCreate.mockReset().mockResolvedValue({ id: 'cs_1', client_secret: 'secret' })
  mockSlot.mockReset().mockResolvedValue(true)
})
afterEach(() => vi.restoreAllMocks())

describe('POST /api/tickets/checkout', () => {
  it('lets a guest buy, and stores the session before answering', async () => {
    const res = await post(body)
    expect(await res.json()).toEqual({ client_secret: 'secret' })
    expect(updates).toEqual([{ stripe_checkout_session_id: 'cs_1' }])
    expect(inserted[0]).toMatchObject({ buyer_profile_id: null, door_event_id: null, total_cents: 500 })
    expect(mockSlot).toHaveBeenCalledWith('1.2.3.4')
  })

  it('ignores price and entries in the request', async () => {
    await post({ ...body, price_cents: 1, total_cents: 1, entries: 99 })
    expect(inserted[0]).toMatchObject({ total_cents: 500 })
    expect(inserted[0]).not.toHaveProperty('entries')
    const [params, options] = mockCreate.mock.calls[0]
    expect(params.line_items[0].price_data).toMatchObject({ currency: 'eur', unit_amount: 500 })
    expect(params).toMatchObject({ client_reference_id: 'order1', payment_intent_data: { metadata: { order_id: 'order1' } } })
    expect(options).toEqual({ idempotencyKey: 'order1' })
  })

  it('links a member only for their own verified email', async () => {
    mockAuth.mockResolvedValue({ userId: 'u' })
    mockUser.mockResolvedValue({ emailAddresses: [{ emailAddress: 'Ann@example.com', verification: { status: 'verified' } }] })
    await post(body)
    await post({ ...body, email: 'bob@example.com' })
    expect(inserted.map((r) => r.buyer_profile_id)).toEqual(['profile1', null])
  })

  it.each([
    ['after the 30 minutes', () => { event.end_time = minutes(-31) }, 409],
    ['a cancelled session', () => { event.tickets_cancelled_at = minutes(-1) }, 409],
    ['a Google event', () => { event.source = 'google' }, 404],
    ['an ordinary portal event', () => { event.source = 'portal'; event.series_key = null }, 404],
    ['another series', () => { event.series_key = 'monday' }, 409],
  ])('refuses %s', async (_label, change, status) => {
    change()
    expect((await post(body)).status).toBe(status)
    expect(inserted).toHaveLength(0)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('still sells 29 minutes after the end', async () => {
    event.end_time = minutes(-29)
    expect((await post(body)).status).toBe(200)
  })

  it('door: refuses a full room and another day, before payment', async () => {
    admitted = 10
    expect(await (await post({ ...body, door: true })).json()).toMatchObject({ code: 'full' })
    admitted = 0
    event.start_time = minutes(3 * 24 * 60)
    event.end_time = minutes(3 * 24 * 60 + 90)
    expect(await (await post({ ...body, door: true })).json()).toMatchObject({ code: 'door_closed' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('stores the door event', async () => {
    await post({ ...body, door: true })
    expect(inserted[0]).toMatchObject({ door_event_id: EVENT })
  })

  it('is rate limited and validates input', async () => {
    expect((await post({ ...body, email: 'x' })).status).toBe(400)
    mockSlot.mockResolvedValue(false)
    expect((await post(body)).status).toBe(429)
    expect(inserted).toHaveLength(0)
  })
})
