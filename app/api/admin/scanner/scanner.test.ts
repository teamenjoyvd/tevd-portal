import { beforeEach, describe, expect, it, vi } from 'vitest'

// Real routes and door rules. Faked: the database, Clerk, Zoom.

type Row = Record<string, unknown>
const h = vi.hoisted(() => ({
  userId: 'u1' as string | null,
  tables: {} as Record<string, Record<string, unknown>[]>,
  rpc: vi.fn(),
}))
vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: h.userId }) }))
vi.mock('@/lib/server/zoom/port', () => ({ createZoomPort: () => ({}) }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    rpc: h.rpc,
    from: (table: string) => {
      let rows = h.tables[table] ?? []
      const keep = (f: (r: Row) => boolean) => {
        rows = rows.filter(f)
        return q
      }
      const q = {
        select: () => q,
        order: () => q,
        eq: (k: string, v: unknown) => keep((r) => r[k] === v),
        in: (k: string, v: unknown[]) => keep((r) => v.includes(r[k])),
        gt: (k: string, v: string) => keep((r) => (r[k] as string) > v),
        ilike: (k: string, v: string) => {
          const text = v.slice(1, -1).replace(/\\(.)/g, '$1').toLowerCase()
          return keep((r) => String(r[k]).toLowerCase().includes(text))
        },
        limit: (n: number) => {
          rows = rows.slice(0, n)
          return q
        },
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        single: async () => ({ data: rows[0] ?? null, error: null }),
        then: (ok: (v: unknown) => void) => ok({ data: rows, error: null }),
      }
      return q
    },
  }),
}))

import * as lookup from './lookup/route'
import * as redeemRoute from './redeem/route'
import * as walkIn from './walk-in/route'

const EV = '11111111-1111-4111-8111-111111111111'
const PASS = '44444444-4444-4444-8444-444444444444'
const iso = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString()
const req = (body: unknown) => new Request('http://x/', { method: 'POST', body: JSON.stringify(body) })
const byCode = { event_id: EV, code: 'abcd2345' }
const admit = { event_id: EV, pass_id: PASS, via: 'code', names: ['Ann'] }

beforeEach(() => {
  h.userId = 'u1'
  h.rpc.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  h.tables = {
    profiles: [{ id: 's1', clerk_id: 'u1', role: 'core', first_name: 'Sta', last_name: 'Ff' }],
    calendar_events: [{ id: EV, start_time: iso(-5), end_time: iso(60), series_key: 'tuesday', tickets_cancelled_at: null }],
    ticket_products: [
      { id: 'pT', event_id: null, series_key: 'tuesday' },
      { id: 'pM', event_id: null, series_key: 'monday' },
    ],
    ticket_passes: [{
      id: PASS, product_id: 'pT', unlock_code: 'ABCD2345', qr_token: 'q1', holder_name: 'Ann Lee', holder_email: 'ann@example.com',
      entries_total: 2, expires_at: iso(9999), status: 'active',
    }],
    ticket_admissions: [],
  }
})

const use = (count: number, event = EV) => {
  h.tables.ticket_admissions = Array.from({ length: count }, () => ({
    pass_id: PASS, event_id: event, status: 'active', mode: 'in_person', attendee_name: 'Ann Lee',
    created_at: iso(-2), checked_in_at: iso(-1), checked_in_by: 's1',
  }))
}
const look = async (body: unknown = byCode) => (await lookup.POST(req(body))).json()

describe('access', () => {
  const calls = [
    ['lookup', () => lookup.POST(req(byCode))],
    ['list', () => lookup.GET(new Request(`http://x/?event_id=${EV}`))],
    ['redeem', () => redeemRoute.POST(req(admit))],
    ['walk-in', () => walkIn.POST(req({ event_id: EV, name: 'Bo' }))],
  ] as const
  describe.each(calls)('%s', (_name, call) => {
    it.each(['member', 'guest'])('403 for %s', async (role) => {
      h.tables.profiles[0].role = role
      expect((await call()).status).toBe(403)
      expect(h.rpc).not.toHaveBeenCalled()
    })
    it('401 signed out', async () => {
      h.userId = null
      expect((await call()).status).toBe(401)
    })
  })
})

describe('lookup', () => {
  it('green by code and by QR', async () => {
    expect((await look()).pass).toMatchObject({ color: 'green', entriesLeft: 2, holder: 'Ann Lee', reason: null })
    expect((await look({ event_id: EV, qr: 'q1' })).pass.color).toBe('green')
  })
  it('amber when everyone on it is in, with who and by whom', async () => {
    use(2)
    expect((await look()).pass).toMatchObject({ color: 'amber', entriesLeft: 0, admitted: [{ name: 'Ann Lee', staff: 'Sta Ff' }, {}] })
  })
  it('never returns secrets', async () => {
    expect(JSON.stringify(await look())).not.toMatch(/q1|ABCD2345|zoom/)
  })
  it.each<[string, () => void]>([
    ['void', () => { h.tables.ticket_passes[0].status = 'void' }],
    ['expired', () => { h.tables.ticket_passes[0].expires_at = iso(-1) }],
    ['not_covered', () => { h.tables.ticket_passes[0].product_id = 'pM' }],
    ['no_entries', () => use(2, 'other-event')],
    ['cancelled', () => { h.tables.calendar_events[0].tickets_cancelled_at = iso(-1) }],
    ['outside_window', () => { h.tables.calendar_events[0].end_time = iso(-31) }],
  ])('red: %s', async (reason, change) => {
    change()
    expect((await look()).pass).toMatchObject({ color: 'red', reason })
  })
  it('still green 29 minutes after the end', async () => {
    h.tables.calendar_events[0].end_time = iso(-29)
    expect((await look()).pass.color).toBe('green')
  })
  it('404 for an unknown code', async () => {
    expect((await lookup.POST(req({ event_id: EV, code: 'ZZZZ9999' }))).status).toBe(404)
  })
})

describe('search', () => {
  const search = async (text: string) => (await look({ event_id: EV, search: text })).matches
  it('finds by part of the name or email', async () => {
    expect(await search('lee')).toEqual([{ passId: PASS, holder: 'Ann Lee', email: 'ann@example.com' }])
    expect(await search('NN@EX')).toHaveLength(1)
  })
  it('never returns passes of other events, void or expired ones', async () => {
    const pass = h.tables.ticket_passes[0]
    for (const over of [{ product_id: 'pM' }, { status: 'void' }, { expires_at: iso(-1) }]) {
      h.tables.ticket_passes = [{ ...pass, ...over }]
      expect(await search('ann')).toEqual([])
    }
  })
  it('needs 3 characters, treats % as text, and stops at 20', async () => {
    expect((await lookup.POST(req({ event_id: EV, search: ' an ' }))).status).toBe(400)
    expect(await search('%%%')).toEqual([])
    h.tables.ticket_passes = Array.from({ length: 30 }, (_, i) => ({ ...h.tables.ticket_passes[0], id: `p${i}` }))
    expect(await search('ann')).toHaveLength(20)
  })
})

describe('redeem', () => {
  it('admits in person as the caller', async () => {
    h.rpc.mockResolvedValue({ data: [{ mode: 'in_person' }], error: null })
    expect(await (await redeemRoute.POST(req(admit))).json()).toEqual({ admitted: 1 })
    expect(h.rpc).toHaveBeenCalledWith('redeem_pass_entries', {
      p_pass_id: PASS, p_event_id: EV, p_attendees: [{ name: 'Ann' }], p_mode: 'in_person', p_admitted_via: 'code', p_actor: 's1',
    })
  })
  it('reports the reason the database gives', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { code: 'TK007' } })
    const res = await redeemRoute.POST(req(admit))
    expect([res.status, (await res.json()).code]).toEqual([409, 'no_entries'])
  })
  it('refuses a method staff may not claim', async () => {
    expect((await redeemRoute.POST(req({ ...admit, via: 'admin' }))).status).toBe(400)
  })
})

describe('walk-in', () => {
  it('registers without an email', async () => {
    h.rpc.mockResolvedValue({ data: { created: true }, error: null })
    expect((await walkIn.POST(req({ event_id: EV, name: 'Bo Li' }))).status).toBe(200)
    expect(h.rpc.mock.calls[0][1]).toMatchObject({ p_mode: 'in_person', p_admitted_via: 'walk_in', p_email: null, p_actor: 's1' })
  })
  it('says full', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { code: 'TK008', message: '' } })
    const res = await walkIn.POST(req({ event_id: EV, name: 'Bo Li' }))
    expect([res.status, (await res.json()).code]).toEqual([409, 'full'])
  })
})
