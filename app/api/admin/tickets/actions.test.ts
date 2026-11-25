import { beforeEach, describe, expect, it, vi } from 'vitest'

// Real routes and rules. Faked: the database, Clerk, Zoom, email.

type Row = Record<string, unknown>
type Filter = (r: Row) => boolean
const h = vi.hoisted(() => ({
  userId: 'u1' as string | null,
  tables: {} as Record<string, Record<string, unknown>[]>,
  rpc: vi.fn(),
  zoom: { register: vi.fn(), cancel: vi.fn() },
  sendPass: vi.fn(),
  emailLink: vi.fn(),
  verified: [] as string[],
}))
vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: h.userId }),
  clerkClient: async () => ({
    users: { getUser: async () => ({ emailAddresses: h.verified.map((e) => ({ emailAddress: e, verification: { status: 'verified' } })) }) },
  }),
}))
vi.mock('@/lib/server/zoom/port', () => ({ createZoomPort: () => h.zoom }))
vi.mock('@/lib/server/tickets/pass-email', () => ({ sendPassEmail: h.sendPass, MAX_EMAIL_ATTEMPTS: 3 }))
vi.mock('@/lib/server/tickets/link-email', () => ({ emailJoinLink: h.emailLink }))
vi.mock('@/lib/server/tickets/alerts', () => ({ alertAdmins: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    rpc: h.rpc,
    from: (table: string) => {
      const all = h.tables[table] ?? (h.tables[table] = [])
      const filters: Filter[] = []
      let patch: Row | null = null
      const run = () => {
        const rows = all.filter((r) => filters.every((f) => f(r)))
        if (patch !== null) for (const r of rows) Object.assign(r, patch)
        return rows.map((r) => ({ ...r }))
      }
      const keep = (f: Filter) => {
        filters.push(f)
        return q
      }
      const q = {
        select: () => q,
        order: () => q,
        limit: () => q,
        update: (p: Row) => {
          patch = p
          return q
        },
        insert: async (row: Row) => {
          all.push(row)
          return { error: null }
        },
        eq: (k: string, v: unknown) => (k.includes('.') ? q : keep((r) => r[k] === v)),
        is: (k: string, v: unknown) => keep((r) => (r[k] ?? null) === v),
        in: (k: string, v: unknown[]) => keep((r) => v.includes(r[k])),
        not: () => q,
        gt: () => q,
        lt: () => q,
        maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
        single: async () => ({ data: run()[0] ?? null, error: null }),
        then: (ok: (v: unknown) => void) => {
          const data = run()
          ok({ data, count: data.length, error: null })
        },
      }
      return q
    },
  }),
}))

import { findPass } from '@/lib/server/tickets/passes'
import { createServiceClient } from '@/lib/supabase/service'
import * as anonymise from './anonymise/route'
import * as attention from './attention/route'
import * as cancelZoom from './admissions/[id]/cancel-zoom/route'
import * as rename from './admissions/[id]/rename/route'
import * as retry from './admissions/[id]/retry/route'
import * as revoke from './admissions/[id]/revoke/route'
import * as orders from './orders/route'
import * as passes from './passes/route'
import * as email from './passes/[id]/email/route'
import * as expiry from './passes/[id]/expiry/route'
import * as reissue from './passes/[id]/reissue/route'
import * as resend from './passes/[id]/resend/route'
import * as voidRoute from './passes/[id]/void/route'
import * as sessions from './sessions/route'
import * as cancel from './sessions/[id]/cancel/route'

const PASS = '44444444-4444-4444-8444-444444444444'
const ADM = '55555555-5555-4555-8555-555555555555'
const EV = '11111111-1111-4111-8111-111111111111'
const iso = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString()
type Route = (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
const request = (body: unknown = {}) => new Request('http://x/', { method: 'POST', body: JSON.stringify(body) })
const call = (route: { POST: Route }, id: string, body: unknown = {}) => route.POST(request(body), { params: Promise.resolve({ id }) })
const get = (url = 'http://x/') => new Request(url)
const pass = () => h.tables.ticket_passes[0]
const adm = () => h.tables.ticket_admissions[0]
const audits = () => h.tables.ticket_audit
const codeOf = async (res: Response) => [res.status, (await res.json()).code]

beforeEach(() => {
  h.userId = 'u1'
  h.verified = []
  h.rpc.mockReset().mockResolvedValue({ data: [], error: null })
  h.zoom.register.mockReset().mockResolvedValue({ ref: 'r2', joinLink: 'https://zoom.example/2' })
  h.zoom.cancel.mockReset().mockResolvedValue(undefined)
  h.sendPass.mockReset().mockResolvedValue(true)
  h.emailLink.mockReset().mockResolvedValue(undefined)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  h.tables = {
    profiles: [{ id: 'adm', clerk_id: 'u1', role: 'admin' }, { id: 'holder', clerk_id: 'u2', role: 'member' }],
    ticket_passes: [{
      id: PASS, status: 'active', holder_email: 'old@example.com', holder_profile_id: 'holder', expires_at: iso(1000),
      unlock_code: 'ABCD2345', qr_token: 'q1', email_attempts: 3, email_sent_at: null, email_claimed_at: iso(-60),
    }],
    ticket_admissions: [{
      id: ADM, event_id: EV, mode: 'online', status: 'active', attendee_name: 'Ann', attendee_email: 'ann@example.com',
      zoom_attempts: 1, zoom_attempted_at: iso(-60), zoom_ref: 'r1', zoom_join_link: 'https://zoom.example/1', device_token_hash: 'd',
    }],
    calendar_events: [{ id: EV, start_time: iso(60), end_time: iso(120), series_key: 'tuesday', tickets_cancelled_at: null }],
    ticket_audit: [],
  }
})

describe('access', () => {
  const calls: [string, () => Promise<Response>][] = [
    ['resend', () => call(resend, PASS)],
    ['email', () => call(email, PASS, { email: 'new@example.com' })],
    ['expiry', () => call(expiry, PASS, { expires_at: iso(2000) })],
    ['reissue', () => call(reissue, PASS)],
    ['void', () => call(voidRoute, PASS, { reason: 'x' })],
    ['revoke', () => call(revoke, ADM)],
    ['cancel-zoom', () => call(cancelZoom, ADM)],
    ['rename', () => call(rename, ADM, { name: 'Bo Li' })],
    ['retry', () => call(retry, ADM)],
    ['cancel session', () => call(cancel, EV)],
    ['cancel preview', () => cancel.GET(get(), { params: Promise.resolve({ id: EV }) })],
    ['anonymise', () => anonymise.POST(request({ email: 'old@example.com' }))],
    ['passes', () => passes.POST(request({ q: '' }))],
    ['orders', () => orders.POST(request({ q: '' }))],
    ['sessions', () => sessions.GET(get())],
    ['attention', () => attention.GET()],
  ]
  it.each(calls)('%s: admins only, and nothing changes', async (_name, run) => {
    const before = JSON.stringify(h.tables.ticket_passes.concat(h.tables.ticket_admissions))
    for (const role of ['core', 'member', 'guest']) {
      h.tables.profiles[0].role = role
      expect((await run()).status).toBe(403)
    }
    h.userId = null
    expect((await run()).status).toBe(401)
    expect(JSON.stringify(h.tables.ticket_passes.concat(h.tables.ticket_admissions))).toBe(before)
    expect(audits()).toEqual([])
    expect(h.rpc).not.toHaveBeenCalled()
    expect(h.zoom.cancel).not.toHaveBeenCalled()
  })
  it('refuses a bad id or body', async () => {
    expect((await call(resend, 'x')).status).toBe(400)
    expect((await call(voidRoute, PASS, { reason: ' ' })).status).toBe(400)
    expect((await call(email, PASS, { email: 'no' })).status).toBe(400)
  })
})

describe('passes', () => {
  it('resend starts the attempts again and sends', async () => {
    expect(await (await call(resend, PASS)).json()).toEqual({ emailed: true })
    expect(pass()).toMatchObject({ email_attempts: 0, email_claimed_at: null })
    expect(audits()).toEqual([
      expect.objectContaining({ actor_profile_id: 'adm', action: 'resend_email', pass_id: PASS, before: { email_attempts: 3, email_sent_at: null } }),
    ])
  })
  it('says when the email did not leave', async () => {
    h.sendPass.mockRejectedValue(new Error('x'))
    expect(await (await call(resend, PASS)).json()).toEqual({ emailed: false })
  })
  it('a corrected email unlinks the profile unless Clerk verified it', async () => {
    await call(email, PASS, { email: 'New@example.com' })
    expect(pass()).toMatchObject({ holder_email: 'New@example.com', holder_profile_id: null })
    expect(audits()[0]).toMatchObject({
      before: { holder_email: 'old@example.com', holder_profile_id: 'holder' },
      after: { holder_email: 'New@example.com', holder_profile_id: null },
    })
    pass().holder_profile_id = 'holder'
    h.verified = ['new@example.com']
    await call(email, PASS, { email: 'New@example.com' })
    expect(pass().holder_profile_id).toBe('holder')
  })
  it('expiry only moves later', async () => {
    expect(await codeOf(await call(expiry, PASS, { expires_at: iso(999) }))).toEqual([400, 'not_later'])
    expect(audits()).toEqual([])
    const [before, after] = [pass().expires_at, iso(2000)]
    expect((await call(expiry, PASS, { expires_at: after })).status).toBe(200)
    expect(audits()[0]).toMatchObject({ before: { expires_at: before }, after: { expires_at: after } })
  })
  it('a reissued code replaces code and QR, and neither reaches the audit or the reply', async () => {
    const res = await call(reissue, PASS)
    const text = await res.text()
    const now = pass()
    expect(now.unlock_code).not.toBe('ABCD2345')
    expect(now.qr_token).not.toBe('q1')
    // The lookup both the join page and the scanner use.
    expect(await findPass(createServiceClient(), { code: 'ABCD2345' })).toBeNull()
    expect(await findPass(createServiceClient(), { qrToken: 'q1' })).toBeNull()
    for (const secret of ['ABCD2345', 'q1', String(now.unlock_code), String(now.qr_token)]) {
      expect(JSON.stringify(audits())).not.toContain(`"${secret}"`)
      expect(text).not.toContain(secret)
    }
    expect(audits()[0]).toMatchObject({ action: 'reissue_code', before: { unlock_code: '******45' } })
    expect(h.sendPass).toHaveBeenCalled()
  })
  it('void keeps the reason and cannot be repeated or acted on', async () => {
    await call(voidRoute, PASS, { reason: 'Lost' })
    expect(pass()).toMatchObject({ status: 'void', void_reason: 'Lost' })
    expect(audits()[0]).toMatchObject({ before: { status: 'active' }, after: { status: 'void', void_reason: 'Lost' } })
    for (const route of [resend, reissue]) expect(await codeOf(await call(route, PASS))).toEqual([409, 'void'])
    expect(audits()).toHaveLength(1)
    expect(adm().status).toBe('active')
  })
})

describe('revoke', () => {
  it('revokes, kills the link and cancels in Zoom', async () => {
    expect(await (await call(revoke, ADM)).json()).toEqual({ zoomCancelled: true, online: true })
    expect(adm()).toMatchObject({ status: 'revoked', zoom_join_link: null, zoom_ref: null, device_token_hash: null })
    expect(audits()[0]).toMatchObject({ admission_id: ADM, before: { status: 'active' }, after: { status: 'revoked' } })
    expect(await codeOf(await call(revoke, ADM))).toEqual([409, 'revoked'])
  })
  it('stays revoked when Zoom fails, and can be retried', async () => {
    h.zoom.cancel.mockRejectedValue(new Error('x'))
    expect((await (await call(revoke, ADM)).json()).zoomCancelled).toBe(false)
    expect(adm()).toMatchObject({ status: 'revoked', zoom_ref: 'r1', zoom_join_link: null })
    expect(await codeOf(await call(cancelZoom, ADM))).toEqual([502, 'zoom_failed'])
    h.zoom.cancel.mockResolvedValue(undefined)
    expect((await call(cancelZoom, ADM)).status).toBe(200)
    expect(adm().zoom_ref).toBeNull()
    expect(audits().at(-1)).toMatchObject({ before: { registered_in_zoom: true }, after: { registered_in_zoom: false } })
    expect(await codeOf(await call(cancelZoom, ADM))).toEqual([409, 'nothing_to_cancel'])
  })
})

describe('rename', () => {
  it('uses the same row, a new registration, and emails the link', async () => {
    expect(await (await call(rename, ADM, { name: 'Bo Li' })).json()).toEqual({ registered: true })
    expect(h.tables.ticket_admissions).toHaveLength(1)
    expect(adm()).toMatchObject({ attendee_name: 'Bo Li', status: 'active', zoom_ref: 'r2', zoom_attempts: 2, device_token_hash: null })
    expect(h.zoom.cancel).toHaveBeenCalledWith({ eventId: EV, ref: 'r1' })
    expect(h.emailLink).toHaveBeenCalledOnce()
    expect(audits()[0]).toMatchObject({ before: { attendee_name: 'Ann' }, after: { attendee_name: 'Bo Li' } })
  })
  it('changes nothing when Zoom refuses the cancel', async () => {
    const before = { ...adm() }
    h.zoom.cancel.mockRejectedValue(new Error('x'))
    expect(await codeOf(await call(rename, ADM, { name: 'Bo Li' }))).toEqual([502, 'zoom_failed'])
    expect(adm()).toMatchObject(before)
    expect(audits()).toEqual([])
  })
  it('stays pending when only the registration fails', async () => {
    h.zoom.register.mockRejectedValue(new Error('x'))
    expect(await (await call(rename, ADM, { name: 'Bo Li' })).json()).toEqual({ registered: false })
    expect(adm()).toMatchObject({ status: 'pending_zoom', zoom_ref: null, attendee_name: 'Bo Li' })
    expect(h.emailLink).not.toHaveBeenCalled()
  })
  it('waits for a running registration', async () => {
    Object.assign(adm(), { status: 'pending_zoom', zoom_attempted_at: iso(-1), zoom_ref: null, zoom_join_link: null })
    const before = { ...adm() }
    expect(await codeOf(await call(rename, ADM, { name: 'Bo Li' }))).toEqual([409, 'busy'])
    expect(adm()).toEqual(before)
    expect(h.zoom.register).not.toHaveBeenCalled()
    adm().zoom_attempted_at = iso(-3)
    expect(await (await call(rename, ADM, { name: 'Bo Li' })).json()).toEqual({ registered: true })
  })
  it('does not wait once registered', async () => {
    adm().zoom_attempted_at = iso(0)
    expect(await (await call(rename, ADM, { name: 'Bo Li' })).json()).toEqual({ registered: true })
  })
  it.each<[string, () => void]>([
    ['started',() => { h.tables.calendar_events[0].start_time = iso(-1) }],
    ['attempts_used', () => { adm().zoom_attempts = 3 }],
    ['not_online', () => { adm().mode = 'in_person' }],
    ['not_online', () => { adm().status = 'revoked' }],
  ])('refused: %s', async (code, change) => {
    change()
    expect(await codeOf(await call(rename, ADM, { name: 'Bo Li' }))).toEqual([409, code])
    expect(h.zoom.cancel).not.toHaveBeenCalled()
  })
})

describe('retry', () => {
  beforeEach(() => { Object.assign(adm(), { status: 'pending_zoom', zoom_attempts: 2, zoom_ref: null, zoom_join_link: null }) })
  it('uses the third attempt and emails the link', async () => {
    expect(await (await call(retry, ADM)).json()).toEqual({ registered: true })
    expect(audits()[0]).toMatchObject({
      before: { status: 'pending_zoom', zoom_attempts: 2 }, after: { status: 'active', zoom_attempts: 3 },
    })
    expect(h.emailLink).toHaveBeenCalledOnce()
  })
  it('never a fourth', async () => {
    h.zoom.register.mockRejectedValue(new Error('x'))
    expect(await (await call(retry, ADM)).json()).toEqual({ registered: false })
    expect(await codeOf(await call(retry, ADM))).toEqual([409, 'attempts_used'])
    expect(h.zoom.register).toHaveBeenCalledOnce()
  })
  it('waits for a running attempt, and refuses a finished row', async () => {
    adm().zoom_attempted_at = iso(0)
    expect(await codeOf(await call(retry, ADM))).toEqual([409, 'busy'])
    adm().status = 'active'
    expect(await codeOf(await call(retry, ADM))).toEqual([409, 'not_pending'])
  })
})

describe('session and person', () => {
  it('previews, then cancels every online registration and reports failures', async () => {
    const preview = await cancel.GET(get(), { params: Promise.resolve({ id: EV }) })
    expect(await preview.json()).toEqual({ passes: 1, admissions: 1 })
    h.rpc.mockResolvedValue({ data: [{ ...adm(), status: 'revoked' }, { id: 'x', mode: 'in_person', zoom_ref: null }], error: null })
    h.zoom.cancel.mockRejectedValue(new Error('x'))
    expect(await (await call(cancel, EV)).json()).toEqual({ zoomFailed: 1 })
    expect(h.rpc).toHaveBeenCalledWith('cancel_ticketed_session', { p_event_id: EV, p_actor: 'adm' })
    expect(h.zoom.cancel).toHaveBeenCalledOnce()
    expect(adm().zoom_join_link).toBeNull()
    expect(audits()[0]).toMatchObject({ action: 'cancel_session', after: { event_id: EV, revoked: 2 } })
  })
  it('refuses a second cancel', async () => {
    h.tables.calendar_events[0].tickets_cancelled_at = iso(-1)
    expect(await codeOf(await call(cancel, EV))).toEqual([409, 'cancelled'])
    expect(h.rpc).not.toHaveBeenCalled()
  })
  it('anonymises as the caller and cancels in Zoom', async () => {
    h.rpc.mockResolvedValue({ data: [{ ...adm() }], error: null })
    expect(await (await anonymise.POST(request({ email: 'ann@example.com' }))).json()).toEqual({ zoomFailed: 0 })
    expect(h.rpc).toHaveBeenCalledWith('anonymise_ticket_holder', { p_email: 'ann@example.com', p_actor: 'adm' })
    expect(adm().zoom_ref).toBeNull()
  })
})
