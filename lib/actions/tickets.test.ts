import { createHash } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The real action, device, flow, redeem and release code over an in-memory
// PostgREST subset. Faked: the database, Zoom, email sending, Clerk, cookies.

type Row = Record<string, unknown>
const h = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  rpc: vi.fn(),
  jar: new Map<string, string>(),
  after: [] as (() => unknown)[],
  rateLimit: vi.fn(),
  zoom: { register: vi.fn(), cancel: vi.fn() },
  send: vi.fn(),
  userId: null as string | null,
}))

function fakeDb() {
  const from = (table: string) => {
    let rows = h.tables[table] ?? (h.tables[table] = [])
    let mode: 'select' | 'update' | 'delete' = 'select'
    let patch: Row = {}
    const run = () => {
      const out = rows.map((r) => ({ ...r, ...(mode === 'update' ? patch : {}) }))
      if (mode === 'update') for (const r of rows) Object.assign(r, patch)
      if (mode === 'delete') h.tables[table] = h.tables[table].filter((r) => !rows.includes(r))
      return out
    }
    const keep = (f: (r: Row) => boolean) => {
      rows = rows.filter(f)
      return q
    }
    const get = (r: Row, path: string) => path.split('.').reduce<unknown>((v, k) => (v as Row | undefined)?.[k], r)
    const q = {
      select: () => q,
      update: (p: Row) => { mode = 'update'; patch = p; return q },
      delete: () => { mode = 'delete'; return q },
      upsert: async (row: Row) => {
        h.tables[table] = [...h.tables[table].filter((r) => r.admission_id !== row.admission_id), row]
        return { error: null }
      },
      eq: (k: string, v: unknown) => keep((r) => get(r, k) === v),
      neq: (k: string, v: unknown) => keep((r) => get(r, k) !== v),
      is: (k: string, v: unknown) => keep((r) => (get(r, k) ?? null) === v),
      not: (k: string) => keep((r) => (get(r, k) ?? null) !== null),
      in: (k: string, v: unknown[]) => keep((r) => v.includes(get(r, k))),
      ilike: (k: string, v: string) => keep((r) => String(get(r, k)).toLowerCase() === v.replace(/\\(.)/g, '$1').toLowerCase()),
      // As in SQL, NULL is never less than anything.
      lt: (k: string, v: string | number) => keep((r) => (get(r, k) ?? null) !== null && (get(r, k) as string) < (v as string)),
      gt: (k: string, v: string | number) => keep((r) => (get(r, k) as string) > (v as string)),
      order: () => q,
      limit: () => q,
      maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
      then: (ok: (v: unknown) => void) => ok({ data: run(), error: null }),
    }
    return q
  }
  return { from, rpc: h.rpc }
}

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => fakeDb() }))
vi.mock('@/lib/server/zoom/port', () => ({ createZoomPort: () => h.zoom }))
vi.mock('@/lib/email/send', () => ({ sendTransactionalEmail: h.send }))
vi.mock('@/lib/utils/base-url', () => ({ getBaseUrl: async () => 'https://portal.example' }))
vi.mock('next/server', () => ({ after: (f: () => unknown) => h.after.push(f) }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' }),
  cookies: async () => ({
    get: (name: string) => (h.jar.has(name) ? { value: h.jar.get(name) } : undefined),
    getAll: () => [...h.jar].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => h.jar.set(name, value),
  }),
}))
vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: h.userId }),
  currentUser: async () => ({
    emailAddresses: [{ id: 'm1', emailAddress: 'Member@example.com', verification: { status: 'verified' } }],
    primaryEmailAddressId: 'm1',
  }),
}))

import * as actions from './tickets'
import { heldAdmissions } from '@/lib/server/tickets/held'
import { releaseLeft } from '@/lib/server/tickets/release'
import { getTicketFlow } from '@/lib/server/tickets/flow'
import { createServiceClient } from '@/lib/supabase/service'

const EV = '11111111-1111-4111-8111-111111111111'
const A1 = '22222222-2222-4222-8222-222222222222'
const A2 = '33333333-3333-4333-8333-333333333333'
const PASS = '44444444-4444-4444-8444-444444444444'
const CODE = 'ABCD2345'
const LINK = 'https://zoom.example/j/secret'
const iso = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString()
const sha = (text: string) => createHash('sha256').update(text).digest('hex')

function admission(over: Row = {}): Row {
  return {
    id: A1, pass_id: PASS, event_id: EV, attendee_name: 'Ann', attendee_email: 'ann@example.com', mode: 'online',
    status: 'active', device_token_hash: null, zoom_ref: 'r1', zoom_join_link: LINK, zoom_attempts: 1,
    zoom_attempted_at: null, zoom_left_at: null, attended_online_at: null,
    calendar_events: h.tables.calendar_events[0], ticket_passes: { status: 'active' }, ...over,
  }
}
async function runAfter() {
  for (const f of h.after.splice(0)) await f()
}
const sentText = () => JSON.stringify(h.send.mock.calls)
const oneTimeCode = () => /letter-spacing:4px[^>]*>(\d{6})</.exec(h.send.mock.calls.at(-1)![0].html as string)![1]

beforeEach(() => {
  h.jar.clear()
  h.after.length = 0
  h.userId = null
  h.tables = {
    calendar_events: [{
      id: EV, title: 'Tuesday', start_time: iso(-5), end_time: iso(60), source: 'zoom', series_key: 'tuesday', tickets_cancelled_at: null,
    }],
    ticket_products: [{ kind: 'single', active: true, event_id: null, series_key: 'tuesday' }],
    ticket_passes: [{
      id: PASS, unlock_code: CODE, holder_name: 'Ann', holder_email: 'ann@example.com', entries_total: 3, status: 'active',
      expires_at: iso(9999), qr_token: 'qr', email_sent_at: null, email_attempts: 0, ticket_products: { kind: 'single' },
    }],
    ticket_admissions: [],
    ticket_device_codes: [],
    profiles: [],
  }
  h.rateLimit.mockReset().mockReturnValue({ data: true, error: null })
  h.rpc.mockReset().mockImplementation(async (name: string, args: unknown) => h.rateLimit(name, args))
  h.zoom.register.mockReset().mockResolvedValue({ ref: 'r2', joinLink: LINK })
  h.zoom.cancel.mockReset().mockResolvedValue(undefined)
  h.send.mockReset().mockResolvedValue({ sent: true })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('flow', () => {
  const kind = async () => (await getTicketFlow(createServiceClient(), EV))?.kind
  it('is decided by the product', async () => {
    expect(await kind()).toBe('code')
    h.tables.ticket_products[0].active = false
    expect(await kind()).toBe('code')
    h.tables.ticket_products.push({ kind: 'free_registration', active: true, event_id: null, series_key: 'tuesday' })
    expect(await kind()).toBe('free')
    h.tables.ticket_products = []
    expect(await kind()).toBe('closed')
  })
  it('leaves Google events and portal events without a product to the guest flow', async () => {
    h.tables.ticket_products = []
    for (const source of ['google', 'portal']) {
      h.tables.calendar_events[0].source = source
      expect(await kind()).toBeUndefined()
    }
  })
})

describe('free registration', () => {
  const input = { eventId: EV, name: 'Ann Lee', email: 'ann@example.com' }
  const answer = (created: boolean, row: Row) =>
    h.rpc.mockImplementation(async (name: string, args: unknown) => {
      if (name !== 'register_free_admission') return h.rateLimit(name, args)
      return { data: { created, admission: row }, error: null }
    })
  beforeEach(() => {
    h.tables.ticket_products = [{ kind: 'free_registration', active: true, event_id: null, series_key: 'tuesday' }]
    h.tables.ticket_admissions = [admission({ status: 'pending_zoom', zoom_ref: null, zoom_join_link: null, zoom_attempts: 0 })]
  })

  it('claims this device and emails a portal link, never a Zoom link', async () => {
    answer(true, h.tables.ticket_admissions[0])
    expect(await actions.registerFree(input)).toEqual({ ok: true, admissionId: A1, ready: true })
    await runAfter()
    expect(sentText()).toContain(`https://portal.example/events/${EV}/join?a=${A1}`)
    expect(sentText()).not.toContain('zoom.example')
    expect(await actions.joinAdmission({ admissionId: A1 })).toEqual({ ok: true, url: LINK })
  })

  it('shows nothing to someone who typed an address that is already registered', async () => {
    answer(false, admission())
    expect(await actions.registerFree(input)).toEqual({ ok: true, admissionId: null, ready: false })
    expect(h.jar.size).toBe(0)
    expect(h.send).toHaveBeenCalledOnce()
  })

  it('keeps the place when Zoom fails', async () => {
    h.zoom.register.mockRejectedValue(new Error('down'))
    answer(true, h.tables.ticket_admissions[0])
    expect(await actions.registerFree(input)).toEqual({ ok: true, admissionId: A1, ready: false })
    expect(h.tables.ticket_admissions[0].status).toBe('pending_zoom')
  })

  it('says full', async () => {
    h.rpc.mockImplementation(async (name: string, args: unknown) =>
      name === 'register_free_admission' ? { data: null, error: { code: 'TK008', message: '' } } : h.rateLimit(name, args))
    expect(await actions.registerFree(input)).toEqual({ ok: false, code: 'full' })
    expect(h.zoom.register).not.toHaveBeenCalled()
  })

  it('registers a member as themself', async () => {
    h.userId = 'u1'
    h.tables.profiles = [{ id: 'p1', clerk_id: 'u1', first_name: 'Mem', last_name: 'Ber' }]
    answer(true, h.tables.ticket_admissions[0])
    await actions.registerFree({ ...input, email: 'victim@example.com' })
    const args = h.rpc.mock.calls.find(([name]) => name === 'register_free_admission')![1]
    expect(args).toMatchObject({ p_name: 'Mem Ber', p_email: 'member@example.com', p_profile_id: 'p1' })
  })

  it('refuses a paid event', async () => {
    h.tables.ticket_products[0].kind = 'single'
    expect(await actions.registerFree(input)).toEqual({ ok: false, code: 'not_ticketed' })
  })
})

describe('code', () => {
  const check = (code = CODE) => actions.checkCode({ eventId: EV, code })

  it('shows names and positions, never ids or links', async () => {
    h.tables.ticket_admissions = [admission()]
    const result = await check(' abcd2345 ')
    expect(result).toEqual({ ok: true, holderName: 'Ann', entriesLeft: 2, holderAdmitted: true, admitted: [{ position: 0, name: 'Ann' }] })
    expect(JSON.stringify(result)).not.toContain(A1)
    expect(JSON.stringify(result)).not.toContain('zoom')
  })

  it('blocks on the limit, and on a limiter error', async () => {
    h.rateLimit.mockReturnValue({ data: false, error: null })
    expect(await check()).toEqual({ ok: false, code: 'rate_limited' })
    h.rateLimit.mockReturnValue({ data: null, error: { code: 'XX000', message: 'down' } })
    expect(await check()).toEqual({ ok: false, code: 'rate_limited' })
  })

  it('limits per IP and per code, and the code is not in the key', async () => {
    await check()
    const keys = h.rateLimit.mock.calls.map(([, a]) => (a as { p_key: string }).p_key)
    expect(keys).toHaveLength(2)
    expect(keys[0]).toBe('ticket-code:ip:203.0.113.5')
    expect(keys.join()).not.toContain(CODE)
  })

  it('takes no code outside the window', async () => {
    Object.assign(h.tables.calendar_events[0], { start_time: iso(3 * 1440), end_time: iso(3 * 1440 + 60) })
    expect(await check()).toEqual({ ok: false, code: 'outside_window' })
    Object.assign(h.tables.calendar_events[0], { start_time: iso(-60), end_time: iso(-1) })
    expect(await check()).toEqual({ ok: false, code: 'outside_window' })
  })

  it('refuses a void pass', async () => {
    h.tables.ticket_passes[0].status = 'void'
    expect(await check()).toEqual({ ok: false, code: 'void' })
  })

  it('gives this device the holder only, and emails the guest', async () => {
    const pending = { status: 'pending_zoom', zoom_ref: null, zoom_join_link: null, zoom_attempts: 0 }
    const rows = [admission(pending), admission({ ...pending, id: A2, attendee_name: 'Bo', attendee_email: 'bo@example.com' })]
    h.rpc.mockImplementation(async (name: string, args: unknown) => {
      if (name !== 'redeem_pass_entries') return h.rateLimit(name, args)
      h.tables.ticket_admissions = rows
      return { data: rows.map((r) => ({ ...r })), error: null }
    })
    const guests = [{ name: 'Bo', email: 'bo@example.com' }]
    expect(await actions.redeemCode({ eventId: EV, code: CODE, includeHolder: true, guests }))
      .toEqual({ ok: true, admissionId: A1, ready: true, emailed: 1 })
    expect([...h.jar.keys()]).toEqual([`tkt_${A1}`])
    await runAfter()
    expect(h.send).toHaveBeenCalledOnce()
    expect(h.send.mock.calls[0][0].to).toBe('bo@example.com')
    expect(sentText()).not.toContain('zoom.example')
  })
})

describe('device', () => {
  beforeEach(() => {
    h.tables.ticket_admissions = [admission()]
  })

  it('first device wins; another needs the one-time code, which works once', async () => {
    expect((await actions.joinAdmission({ admissionId: A1 })).ok).toBe(true)
    const first = new Map(h.jar)
    h.jar.clear()
    expect(await actions.joinAdmission({ admissionId: A1 })).toEqual({ ok: false, code: 'other_device' })

    expect(await actions.requestDeviceCode({ admissionId: A1 })).toEqual({ ok: true })
    const code = oneTimeCode()
    const wrong = code === '000000' ? '000001' : '000000'
    expect(await actions.confirmDeviceCode({ admissionId: A1, code: wrong })).toEqual({ ok: false, code: 'not_found' })
    expect(await actions.confirmDeviceCode({ admissionId: A1, code })).toEqual({ ok: true })
    expect((await actions.joinAdmission({ admissionId: A1 })).ok).toBe(true)
    expect(await actions.confirmDeviceCode({ admissionId: A1, code })).toEqual({ ok: false, code: 'not_found' })

    // The old device lost it.
    h.jar.clear()
    for (const [k, v] of first) h.jar.set(k, v)
    expect(await actions.joinAdmission({ admissionId: A1 })).toEqual({ ok: false, code: 'other_device' })
  })

  it('refuses an expired code and one for another place', async () => {
    h.tables.ticket_admissions.push(admission({ id: A2 }))
    await actions.requestDeviceCode({ admissionId: A1 })
    expect(await actions.confirmDeviceCode({ admissionId: A2, code: oneTimeCode() })).toEqual({ ok: false, code: 'not_found' })
    h.tables.ticket_device_codes[0].expires_at = iso(-1)
    expect(await actions.confirmDeviceCode({ admissionId: A1, code: oneTimeCode() })).toEqual({ ok: false, code: 'not_found' })
  })

  it('limits guesses', async () => {
    h.rateLimit.mockReturnValue({ data: false, error: null })
    expect(await actions.confirmDeviceCode({ admissionId: A1, code: '123456' })).toEqual({ ok: false, code: 'rate_limited' })
  })

  it('from the code screen, only the place owner gets the code and nobody is moved without it', async () => {
    expect(await actions.requestDeviceCodeByPosition({ eventId: EV, code: CODE, position: 0 })).toEqual({ ok: true })
    expect(h.send.mock.calls[0][0].to).toBe('ann@example.com')
    expect(await actions.requestDeviceCodeByPosition({ eventId: EV, code: CODE, position: 7 })).toEqual({ ok: false, code: 'not_found' })
    expect(await actions.confirmDeviceCodeByPosition({ eventId: EV, code: CODE, position: 0, oneTimeCode: oneTimeCode() }))
      .toEqual({ ok: true, admissionId: A1 })
  })

  it('ignores a tampered cookie', async () => {
    h.tables.ticket_admissions[0].device_token_hash = sha('real')
    const held = () => heldAdmissions(createServiceClient(), EV)
    h.jar.set(`tkt_${A1}`, 'forged')
    expect(await held()).toEqual([])
    // The stored hash itself is not a token.
    h.jar.set(`tkt_${A1}`, sha('real'))
    expect(await held()).toEqual([])
    expect(await actions.joinAdmission({ admissionId: A1 })).toEqual({ ok: false, code: 'other_device' })
    h.jar.set(`tkt_${A1}`, 'real')
    expect(await held()).toEqual([{ id: A1, name: 'Ann' }])
  })

  it.each([
    ['revoked', { status: 'revoked' }, 'not_found'],
    ['void pass', { ticket_passes: { status: 'void' } }, 'void'],
  ])('gives no link: %s', async (_label, over, code) => {
    h.tables.ticket_admissions = [admission(over)]
    expect(await actions.joinAdmission({ admissionId: A1 })).toEqual({ ok: false, code })
  })

  it('gives no link once cancelled or over', async () => {
    h.tables.calendar_events[0].tickets_cancelled_at = iso(-1)
    expect(await actions.joinAdmission({ admissionId: A1 })).toEqual({ ok: false, code: 'cancelled' })
    Object.assign(h.tables.calendar_events[0], { tickets_cancelled_at: null, end_time: iso(-1) })
    expect(await actions.joinAdmission({ admissionId: A1 })).toEqual({ ok: false, code: 'outside_window' })
  })
})

describe('lost code', () => {
  it('answers the same and sends only to a known address', async () => {
    const known = await actions.resendPasses({ email: 'ANN@example.com' })
    expect(h.send).not.toHaveBeenCalled()
    await runAfter()
    expect(h.send).toHaveBeenCalledOnce()
    expect(h.send.mock.calls[0][0].to).toBe('ann@example.com')
    expect(await actions.resendPasses({ email: 'nobody@example.com' })).toEqual(known)
    expect(await actions.resendPasses({ email: 'not an email' })).toEqual(known)
    await runAfter()
    expect(h.send).toHaveBeenCalledOnce()
  })

  it('sends nothing over the limit', async () => {
    h.rateLimit.mockReturnValue({ data: false, error: null })
    expect(await actions.resendPasses({ email: 'ann@example.com' })).toEqual({ ok: true })
    await runAfter()
    expect(h.send).not.toHaveBeenCalled()
  })
})

describe('releaseLeft', () => {
  const run = () => releaseLeft({ supabase: createServiceClient(), zoom: h.zoom })
  const left = (over: Row = {}) => admission({ attended_online_at: iso(-30), zoom_left_at: iso(-11), device_token_hash: sha('t'), ...over })

  it('ends the link, and Join on the same device gives a new one', async () => {
    h.tables.ticket_admissions = [left()]
    expect(await run()).toEqual({ released: 1 })
    expect(h.zoom.cancel).toHaveBeenCalledWith({ eventId: EV, ref: 'r1' })
    expect(h.tables.ticket_admissions[0]).toMatchObject({ status: 'pending_zoom', zoom_ref: null, zoom_join_link: null })
    h.jar.set(`tkt_${A1}`, 't')
    expect((await actions.joinAdmission({ admissionId: A1 })).ok).toBe(true)
    expect(h.tables.ticket_admissions[0]).toMatchObject({ status: 'active', zoom_ref: 'r2' })
  })

  it.each([
    ['within the grace period', { zoom_left_at: iso(-5) }],
    ['still inside', { zoom_left_at: null }],
    ['no attempt left', { zoom_attempts: 2 }],
    ['never attended', { attended_online_at: null }],
  ])('leaves alone: %s', async (_label, over) => {
    h.tables.ticket_admissions = [left(over)]
    expect(await run()).toEqual({ released: 0 })
    expect(h.zoom.cancel).not.toHaveBeenCalled()
  })

  it('puts the link back when Zoom fails', async () => {
    h.zoom.cancel.mockRejectedValue(new Error('down'))
    h.tables.ticket_admissions = [left()]
    expect(await run()).toEqual({ released: 0 })
    expect(h.tables.ticket_admissions[0]).toMatchObject({ status: 'active', zoom_ref: 'r1', zoom_join_link: LINK })
  })
})
