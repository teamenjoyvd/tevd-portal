import type Stripe from 'stripe'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSend = vi.fn()
vi.mock('@/lib/email/send', () => ({ sendTransactionalEmail: (p: unknown) => mockSend(p) }))

const { fulfillOrder } = await import('./fulfill')
const { handleStripeEvent } = await import('./stripe-events')
const { sendPassEmail } = await import('./pass-email')
const { assertKeyMatchesEnvironment, getPublishableKey, isStripeConfigured } = await import('@/lib/server/stripe/client')

type Client = Parameters<typeof sendPassEmail>[0]
type Row = Record<string, unknown>

/** In-memory tables; `fulfill_ticket_order` behaves like the SQL function (tested in supabase/tests). */
function fakeDb(tables: Record<string, Row[]>, fail: { upsert?: boolean } = {}) {
  const from = (name: string) => {
    const rows = (tables[name] ??= [])
    const filters: ((r: Row) => boolean)[] = []
    let patch: Row | null = null
    const run = () => {
      const hit = rows.filter((r) => filters.every((f) => f(r)))
      if (patch !== null) for (const r of hit) Object.assign(r, patch)
      return hit.map((r) => ({ ...r }))
    }
    const query = {
      select: () => query,
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), query),
      is: (c: string, v: unknown) => (filters.push((r) => (r[c] ?? null) === v), query),
      update: (p: Row) => ((patch = p), query),
      insert: async (r: Row | Row[]) => (rows.push(...[r].flat()), { error: null }),
      upsert: async (r: Row) => {
        if (fail.upsert) return { error: { message: 'down' } }
        rows.push(r)
        return { error: null }
      },
      maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
      then: (resolve: (v: unknown) => void) => resolve({ data: run(), error: null }),
    }
    return query
  }
  const rpc = async (_name: string, args: Row) => {
    const order = tables.ticket_orders.find((o) => o.id === args.p_order_id)
    let pass = tables.ticket_passes.find((p) => p.order_id === args.p_order_id)
    const just = order !== undefined && ['pending', 'expired'].includes(String(order.status))
    if (just && order) {
      order.status = 'paid'
      pass = {
        id: 'pass1', order_id: order.id, status: 'active', holder_name: 'Ann', holder_email: 'ann@example.com', unlock_code: 'ABCD2345',
        qr_token: 'tok', entries_total: 1, expires_at: '2027-01-01T00:00:00Z', email_sent_at: null, email_claimed_at: null, email_attempts: 0,
      }
      tables.ticket_passes.push(pass)
    }
    return { data: { just_fulfilled: just, pass: { ...pass }, door_admission_id: null, door_error: null }, error: null }
  }
  return { from, rpc } as unknown as Client
}

let tables: Record<string, Row[]>
let session: Row
let supabase: Client
const stripe = {
  checkout: { sessions: { retrieve: async () => session } },
  charges: { retrieve: async () => ({ metadata: { order_id: 'o1' } }) },
} as unknown as Stripe
const deps = () => ({ supabase, stripe, sendEmail: (id: string) => sendPassEmail(supabase, id) })
const event = (type: string, object: Row, id = 'evt1') => ({ id, type, data: { object } }) as unknown as Stripe.Event

beforeEach(() => {
  tables = {
    ticket_orders: [{ id: 'o1', status: 'pending', total_cents: 500, currency: 'eur', stripe_checkout_session_id: 'cs_1' }],
    ticket_passes: [],
    stripe_events: [],
    profiles: [{ id: 'admin1', role: 'admin' }],
    member_notifications: [],
    ticket_audit: [],
  }
  session = { id: 'cs_1', client_reference_id: 'o1', payment_status: 'paid', amount_total: 500, currency: 'eur', metadata: { event_id: 'e1' } }
  supabase = fakeDb(tables)
  mockSend.mockReset().mockResolvedValue({ sent: true })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('fulfillOrder', () => {
  it('two callers at once produce one pass and one email', async () => {
    const results = await Promise.all([fulfillOrder(deps(), 'cs_1'), fulfillOrder(deps(), 'cs_1')])
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled'])
    expect(tables.ticket_passes).toHaveLength(1)
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['amount', { amount_total: 1 }, 'mismatch'],
    ['currency', { currency: 'bgn' }, 'mismatch'],
    ['unpaid', { payment_status: 'unpaid' }, 'unpaid'],
    ['another session', { id: 'cs_2' }, 'not_found'],
    ['no reference', { client_reference_id: null }, 'not_found'],
  ])('does not fulfil: %s', async (_label, patch, status) => {
    Object.assign(session, patch)
    expect(await fulfillOrder(deps(), 'cs_1')).toEqual({ status })
    expect(tables.ticket_passes).toHaveLength(0)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('fulfils an expired order when its payment arrives', async () => {
    tables.ticket_orders[0].status = 'expired'
    expect(await fulfillOrder(deps(), 'cs_1')).toMatchObject({ status: 'fulfilled', justFulfilled: true })
  })

  it('still shows the pass when the email throws', async () => {
    mockSend.mockRejectedValue(new Error('down'))
    expect(await fulfillOrder(deps(), 'cs_1')).toMatchObject({ status: 'fulfilled' })
  })
})

describe('sendPassEmail', () => {
  it('stops after three failed attempts and never holds the code in the log meta', async () => {
    mockSend.mockResolvedValue({ sent: false, error: 'x' })
    await fulfillOrder(deps(), 'cs_1')
    for (let i = 0; i < 4; i++) {
      tables.ticket_passes[0].email_claimed_at = null
      await sendPassEmail(supabase, 'pass1')
    }
    expect(mockSend).toHaveBeenCalledTimes(3)
    expect(JSON.stringify(mockSend.mock.calls[0][0].meta)).not.toContain('ABCD2345')
  })

  it('carries both languages, the code and non-refundable', async () => {
    await fulfillOrder(deps(), 'cs_1')
    const { html } = mockSend.mock.calls[0][0]
    for (const text of ['ABCD2345', 'non-refundable', 'не подлежи на възстановяване', 'cid:ticket-qr']) expect(html).toContain(text)
  })
})

describe('handleStripeEvent', () => {
  const completed = () => event('checkout.session.completed', { id: 'cs_1' })

  it('a replay creates nothing', async () => {
    await handleStripeEvent(deps(), completed())
    await handleStripeEvent(deps(), completed())
    expect(tables.ticket_passes).toHaveLength(1)
    expect(tables.stripe_events).toHaveLength(1)
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it('an event whose handling failed is processed on redelivery', async () => {
    const broken = { ...deps(), stripe: { checkout: { sessions: { retrieve: async () => { throw new Error('down') } } } } as unknown as Stripe }
    await expect(handleStripeEvent(broken, completed())).rejects.toThrow()
    expect(tables.stripe_events).toHaveLength(0)
    await handleStripeEvent(deps(), completed())
    expect(tables.ticket_passes).toHaveLength(1)
  })

  it('alerts admins about a wrong amount', async () => {
    session.amount_total = 1
    await handleStripeEvent(deps(), completed())
    expect(tables.ticket_passes).toHaveLength(0)
    expect(tables.member_notifications).toHaveLength(1)
  })

  it('expires only a pending order', async () => {
    await handleStripeEvent(deps(), event('checkout.session.expired', { id: 'cs_1' }))
    expect(tables.ticket_orders[0].status).toBe('expired')
    tables.ticket_orders[0].status = 'paid'
    await handleStripeEvent(deps(), event('checkout.session.expired', { id: 'cs_1' }, 'evt2'))
    expect(tables.ticket_orders[0].status).toBe('paid')
  })

  it.each([
    ['charge.dispute.created', { charge: 'ch_1' }, 'disputed'],
    ['charge.refunded', { refunded: true, metadata: { order_id: 'o1' } }, 'refunded'],
  ])('%s voids the pass and alerts', async (type, object, reason) => {
    await fulfillOrder(deps(), 'cs_1')
    await handleStripeEvent(deps(), event(type, object))
    expect(tables.ticket_passes[0]).toMatchObject({ status: 'void', void_reason: reason })
    expect(tables.member_notifications).toHaveLength(1)
    expect(tables.ticket_audit).toHaveLength(1)
  })

  it('keeps the pass on a partial refund', async () => {
    await fulfillOrder(deps(), 'cs_1')
    await handleStripeEvent(deps(), event('charge.refunded', { refunded: false, metadata: { order_id: 'o1' } }))
    expect(tables.ticket_passes[0].status).toBe('active')
  })

  it('retries a refund that arrives before its pass, and ignores foreign charges', async () => {
    const refund = event('charge.refunded', { refunded: true, metadata: { order_id: 'o1' } })
    await expect(handleStripeEvent(deps(), refund)).rejects.toThrow()
    await fulfillOrder(deps(), 'cs_1')
    await handleStripeEvent(deps(), refund)
    expect(tables.ticket_passes[0].status).toBe('void')
    await handleStripeEvent(deps(), event('charge.refunded', { refunded: true, metadata: {} }, 'evt3'))
    await handleStripeEvent(deps(), event('charge.refunded', { refunded: true, metadata: { order_id: 'other' } }, 'evt4'))
  })
})

describe('key guard', () => {
  it('never hands a swapped secret key to a page', () => {
    const [secret, publishable] = ['sk', 'pk'].map((k) => [k, 'test', 'x'].join('_'))
    vi.stubEnv('STRIPE_SECRET_KEY', publishable)
    vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', secret)
    expect(getPublishableKey()).toBeNull()
    expect(isStripeConfigured()).toBe(false)
    vi.stubEnv('STRIPE_SECRET_KEY', secret)
    vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', publishable)
    expect(isStripeConfigured()).toBe(true)
    vi.unstubAllEnvs()
  })

  it('refuses a live key outside production', () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    const live = ['sk', 'live', 'x'].join('_')
    expect(() => assertKeyMatchesEnvironment(live)).toThrow()
    expect(() => assertKeyMatchesEnvironment(['sk', 'test', 'x'].join('_'))).not.toThrow()
    vi.stubEnv('VERCEL_ENV', 'production')
    expect(() => assertKeyMatchesEnvironment(live)).not.toThrow()
    vi.unstubAllEnvs()
  })
})
