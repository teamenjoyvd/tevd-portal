import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { attendEvent, cancelMemberRegistration } from './member-registration'

// -- Notification spies ---------------------------------------------------------
// Fire-and-forget sends are mocked out entirely — only that they were called
// (or not) with the right args is under test here, never real delivery.

const notifySharerOfRegistration = vi.fn()
const notifySharerOfCancellation = vi.fn()

vi.mock('@/lib/notifications/share-events', () => ({
  notifySharerOfRegistration: (...args: unknown[]) => notifySharerOfRegistration(...args),
  notifySharerOfCancellation: (...args: unknown[]) => notifySharerOfCancellation(...args),
}))

// -- Confirmation-email seam (2608-DEV-707) -------------------------------------
// The dispatch chain is mocked at its edges — cap, render, send — so the tests
// assert WHICH branches send and with what, never real delivery. The template
// component itself is left real: React.createElement on it is what would catch
// a prop rename.

type SendPayload = { to: string; subject: string; html: string; template: string; meta?: Record<string, unknown> }
type CapArgs = { recipient: string; template?: string; windowMs: number; max: number }

// Declared by signature rather than by implementation so `.mock.calls[0][0]` is
// typed; the implementations are (re)set in beforeEach.
const sendTransactionalEmail = vi.fn<(payload: SendPayload) => Promise<{ sent: boolean }>>()
const renderEmailTemplate = vi.fn<(element: unknown) => Promise<string>>()
const consumeEmailCap = vi.fn<(args: CapArgs) => Promise<boolean>>()
const getBaseUrl = vi.fn<() => Promise<string>>()

vi.mock('@/lib/email/send', () => ({
  sendTransactionalEmail: (payload: SendPayload) => sendTransactionalEmail(payload),
}))
vi.mock('@/lib/email/templates/render', () => ({
  renderEmailTemplate: (element: unknown) => renderEmailTemplate(element),
}))
vi.mock('@/lib/rate-limit', () => ({
  consumeEmailCap: (args: CapArgs) => consumeEmailCap(args),
}))
vi.mock('@/lib/utils/base-url', () => ({
  getBaseUrl: () => getBaseUrl(),
}))

// -- Fake DB ----------------------------------------------------------------
// A minimal in-memory stand-in for the PostgREST query builder, generalized
// beyond event-shares.test.ts's read-only thenable to also support insert/
// update/count, since attendEvent's branches read and write across three
// tables in one call.

type Row = Record<string, unknown>

function makeDb() {
  return {
    calendar_events: [] as Row[],
    event_share_links: [] as Row[],
    guest_registrations: [] as Row[],
    // 2608-DEV-710 (D10): countAttendeesForCapacity reads approved role
    // holders out of here and subtracts them from the capacity headcount.
    event_role_requests: [] as Row[],
  }
}

type Db = ReturnType<typeof makeDb>

class FakeQuery {
  private filters: Array<(r: Row) => boolean> = []
  private mode: 'select' | 'insert' | 'update' = 'select'
  private writeData: Row = {}
  private wantCount = false
  private nextId: () => string

  constructor(private table: Row[], nextId: () => string) {
    this.nextId = nextId
  }

  select(_cols: string, opts?: { count?: string; head?: boolean }) {
    if (opts?.count) this.wantCount = true
    return this
  }
  insert(data: Row) { this.mode = 'insert'; this.writeData = data; return this }
  update(data: Row) { this.mode = 'update'; this.writeData = data; return this }
  eq(col: string, val: unknown) { this.filters.push(r => r[col] === val); return this }
  is(col: string, val: null) { this.filters.push(r => (r[col] ?? null) === val); return this }

  private matches() { return this.table.filter(r => this.filters.every(f => f(r))) }

  async single() {
    if (this.mode === 'insert') {
      const row: Row = { id: this.nextId(), cancelled_at: null, share_link_id: null, ...this.writeData }
      this.table.push(row)
      return { data: row, error: null }
    }
    const rows = this.matches()
    if (rows.length !== 1) return { data: null, error: { code: rows.length === 0 ? 'PGRST116' : 'multiple' } }
    return { data: rows[0], error: null }
  }

  async maybeSingle() {
    const rows = this.matches()
    return rows.length === 0 ? { data: null, error: null } : { data: rows[0], error: null }
  }

  // Awaited directly (no .single()/.maybeSingle()) — update-without-select and
  // the head:true capacity count both land here.
  then(resolve: (v: { data: Row[] | null; error: null; count?: number }) => unknown) {
    if (this.mode === 'update') {
      const rows = this.matches()
      rows.forEach(r => Object.assign(r, this.writeData))
      resolve({ data: rows, error: null, count: rows.length })
      return
    }
    const rows = this.matches()
    resolve({ data: this.wantCount ? null : rows, error: null, count: rows.length })
  }
}

function buildClient(db: Db, rpc = vi.fn().mockResolvedValue({ data: null, error: null })) {
  let seq = 0
  const nextId = () => `gen-${++seq}`
  return {
    from: (table: keyof Db) => new FakeQuery(db[table], nextId),
    rpc,
  } as unknown as SupabaseClient
}

// -- Fixtures -----------------------------------------------------------------

const EVENT_ID = 'event-1'
const PROFILE_ID = 'profile-1'
const FUTURE = new Date(Date.now() + 3600_000).toISOString()
const PAST = new Date(Date.now() - 3600_000).toISOString()

function seedEvent(db: Db, over: Partial<Row> = {}) {
  db.calendar_events.push({
    id: EVENT_ID,
    title: 'N21 Weekly',
    allow_guest_registration: true,
    start_time: FUTURE,
    end_time: FUTURE,
    guest_capacity: null,
    meeting_url: 'https://meet.example.com/n21',
    ...over,
  })
}

beforeEach(() => {
  notifySharerOfRegistration.mockClear()
  notifySharerOfCancellation.mockClear()
  sendTransactionalEmail.mockClear()
  renderEmailTemplate.mockClear()
  consumeEmailCap.mockClear()
  getBaseUrl.mockClear()
  sendTransactionalEmail.mockResolvedValue({ sent: true })
  renderEmailTemplate.mockResolvedValue('<html>rendered</html>')
  consumeEmailCap.mockResolvedValue(true)
  getBaseUrl.mockResolvedValue('https://portal.example.com')
})

// -- attendEvent ----------------------------------------------------------------

describe('attendEvent', () => {
  it('fresh attend inserts a confirmed member row', async () => {
    const db = makeDb()
    seedEvent(db)
    const client = buildClient(db)

    const result = await attendEvent(client, {
      eventId: EVENT_ID, profileId: PROFILE_ID, profileRole: 'member',
      profileName: 'Ivan Petrov', contactEmail: null,
    })

    expect(result.success).toBe(true)
    expect(db.guest_registrations).toHaveLength(1)
    expect(db.guest_registrations[0]).toMatchObject({
      event_id: EVENT_ID, profile_id: PROFILE_ID, name: 'Ivan Petrov', status: 'confirmed',
    })
  })

  it('is idempotent on a second attend — no duplicate row, no re-notify', async () => {
    const db = makeDb()
    seedEvent(db)
    db.guest_registrations.push({
      id: 'reg-1', event_id: EVENT_ID, profile_id: PROFILE_ID, name: 'Ivan Petrov',
      status: 'confirmed', cancelled_at: null, share_link_id: 'link-1',
    })
    const client = buildClient(db)

    const result = await attendEvent(client, {
      eventId: EVENT_ID, profileId: PROFILE_ID, profileRole: 'member',
      profileName: 'Ivan Petrov', contactEmail: null,
    })

    expect(result).toEqual({ success: true, registrationId: 'reg-1', emailed: false })
    expect(db.guest_registrations).toHaveLength(1)
    expect(notifySharerOfRegistration).not.toHaveBeenCalled()
  })

  it('reactivates a cancelled row instead of inserting', async () => {
    const db = makeDb()
    seedEvent(db)
    db.guest_registrations.push({
      id: 'reg-1', event_id: EVENT_ID, profile_id: PROFILE_ID, name: 'Old Name',
      status: 'confirmed', cancelled_at: '2026-08-01T00:00:00.000Z', share_link_id: null,
    })
    const client = buildClient(db)

    const result = await attendEvent(client, {
      eventId: EVENT_ID, profileId: PROFILE_ID, profileRole: 'member',
      profileName: 'New Name', contactEmail: null,
    })

    expect(result).toEqual({ success: true, registrationId: 'reg-1', emailed: false })
    expect(db.guest_registrations).toHaveLength(1)
    expect(db.guest_registrations[0]).toMatchObject({ cancelled_at: null, name: 'New Name', status: 'confirmed' })
  })

  it('D9: adopts an existing guest row for the same email instead of inserting a second row', async () => {
    const db = makeDb()
    seedEvent(db)
    db.guest_registrations.push({
      id: 'guest-reg-1', event_id: EVENT_ID, profile_id: null, name: 'Ivan (guest)',
      email: 'ivan@example.com', token: 'tok123', expires_at: FUTURE,
      status: 'pending', cancelled_at: null, share_link_id: null,
    })
    const client = buildClient(db)

    const result = await attendEvent(client, {
      eventId: EVENT_ID, profileId: PROFILE_ID, profileRole: 'member',
      profileName: 'Ivan Petrov', contactEmail: 'ivan@example.com',
    })

    expect(result).toEqual({ success: true, registrationId: 'guest-reg-1', emailed: true })
    expect(db.guest_registrations).toHaveLength(1)
    expect(db.guest_registrations[0]).toMatchObject({
      profile_id: PROFILE_ID, email: null, token: null, expires_at: null,
      cancelled_at: null, status: 'confirmed', name: 'Ivan Petrov',
    })
  })

  it('does not adopt a guest row that already belongs to another profile', async () => {
    const db = makeDb()
    seedEvent(db)
    db.guest_registrations.push({
      id: 'other-reg', event_id: EVENT_ID, profile_id: 'someone-else', name: 'Someone Else',
      email: 'ivan@example.com', status: 'confirmed', cancelled_at: null, share_link_id: null,
    })
    const client = buildClient(db)

    const result = await attendEvent(client, {
      eventId: EVENT_ID, profileId: PROFILE_ID, profileRole: 'member',
      profileName: 'Ivan Petrov', contactEmail: 'ivan@example.com',
    })

    expect(result.success).toBe(true)
    expect(db.guest_registrations.find(r => r.id === 'other-reg')).toMatchObject({
      profile_id: 'someone-else',
    })
    expect(db.guest_registrations).toHaveLength(2)
  })

  it('rejects when the event is at capacity', async () => {
    const db = makeDb()
    seedEvent(db, { guest_capacity: 1 })
    db.guest_registrations.push({
      id: 'other-reg', event_id: EVENT_ID, profile_id: 'someone-else', name: 'Other',
      status: 'confirmed', cancelled_at: null, share_link_id: null,
    })
    const client = buildClient(db)

    const result = await attendEvent(client, {
      eventId: EVENT_ID, profileId: PROFILE_ID, profileRole: 'member',
      profileName: 'Ivan Petrov', contactEmail: null,
    })

    expect(result).toEqual({ success: false, error: 'This event has reached its guest capacity.' })
    expect(db.guest_registrations).toHaveLength(1)
  })

  // 2608-DEV-710 (D10)
  it('does not count an approved role holder toward capacity', async () => {
    const db = makeDb()
    seedEvent(db, { guest_capacity: 1 })
    db.guest_registrations.push({
      id: 'host-reg', event_id: EVENT_ID, profile_id: 'the-host', name: 'The Host',
      status: 'confirmed', cancelled_at: null, share_link_id: null,
    })
    db.event_role_requests.push({
      id: 'req-1', event_id: EVENT_ID, profile_id: 'the-host', role_label: 'HOST', status: 'approved',
    })
    const client = buildClient(db)

    const result = await attendEvent(client, {
      eventId: EVENT_ID, profileId: PROFILE_ID, profileRole: 'member',
      profileName: 'Ivan Petrov', contactEmail: null,
    })

    // The one existing row belongs to approved staff, so the seat is free.
    expect(result.success).toBe(true)
    expect(db.guest_registrations).toHaveLength(2)
  })

  it('skips the capacity check for an already-active member even when the event is full', async () => {
    const db = makeDb()
    seedEvent(db, { guest_capacity: 1 })
    db.guest_registrations.push({
      id: 'reg-1', event_id: EVENT_ID, profile_id: PROFILE_ID, name: 'Ivan Petrov',
      status: 'confirmed', cancelled_at: null, share_link_id: null,
    })
    const client = buildClient(db)

    const result = await attendEvent(client, {
      eventId: EVENT_ID, profileId: PROFILE_ID, profileRole: 'member',
      profileName: 'Ivan Petrov', contactEmail: null,
    })

    expect(result).toEqual({ success: true, registrationId: 'reg-1', emailed: false })
  })

  it('attributes a valid share token to a different member', async () => {
    const db = makeDb()
    seedEvent(db)
    db.event_share_links.push({ id: 'link-1', token: 'tok-valid', event_id: EVENT_ID, profile_id: 'sharer-1', revoked_at: null })
    const client = buildClient(db)

    const result = await attendEvent(client, {
      eventId: EVENT_ID, profileId: PROFILE_ID, profileRole: 'member',
      profileName: 'Ivan Petrov', contactEmail: null, shareToken: 'tok-valid',
    })

    expect(result.success).toBe(true)
    expect(db.guest_registrations[0]).toMatchObject({ share_link_id: 'link-1' })
    expect(notifySharerOfRegistration).toHaveBeenCalledWith('link-1', 'Ivan Petrov')
  })

  it('does not attribute a revoked share token', async () => {
    const db = makeDb()
    seedEvent(db)
    db.event_share_links.push({ id: 'link-1', token: 'tok-revoked', event_id: EVENT_ID, profile_id: 'sharer-1', revoked_at: '2026-08-01T00:00:00.000Z' })
    const client = buildClient(db)

    const result = await attendEvent(client, {
      eventId: EVENT_ID, profileId: PROFILE_ID, profileRole: 'member',
      profileName: 'Ivan Petrov', contactEmail: null, shareToken: 'tok-revoked',
    })

    expect(result.success).toBe(true)
    expect(db.guest_registrations[0]).toMatchObject({ share_link_id: null })
    expect(notifySharerOfRegistration).not.toHaveBeenCalled()
  })

  it('does not attribute a self-issued share token', async () => {
    const db = makeDb()
    seedEvent(db)
    db.event_share_links.push({ id: 'link-1', token: 'tok-self', event_id: EVENT_ID, profile_id: PROFILE_ID, revoked_at: null })
    const client = buildClient(db)

    const result = await attendEvent(client, {
      eventId: EVENT_ID, profileId: PROFILE_ID, profileRole: 'member',
      profileName: 'Ivan Petrov', contactEmail: null, shareToken: 'tok-self',
    })

    expect(result.success).toBe(true)
    expect(db.guest_registrations[0]).toMatchObject({ share_link_id: null })
    expect(notifySharerOfRegistration).not.toHaveBeenCalled()
  })

  it('rejects a guest-role caller', async () => {
    const db = makeDb()
    seedEvent(db)
    const client = buildClient(db)

    const result = await attendEvent(client, {
      eventId: EVENT_ID, profileId: PROFILE_ID, profileRole: 'guest',
      profileName: 'Guest Person', contactEmail: null,
    })

    expect(result).toEqual({ success: false, error: 'Guests cannot use member attend.' })
    expect(db.guest_registrations).toHaveLength(0)
  })

  it('rejects an ended event', async () => {
    const db = makeDb()
    seedEvent(db, { end_time: PAST })
    const client = buildClient(db)

    const result = await attendEvent(client, {
      eventId: EVENT_ID, profileId: PROFILE_ID, profileRole: 'member',
      profileName: 'Ivan Petrov', contactEmail: null,
    })

    expect(result).toEqual({ success: false, error: 'This event has already ended.' })
    expect(db.guest_registrations).toHaveLength(0)
  })

  it('rejects an event that is not open for registration', async () => {
    const db = makeDb()
    seedEvent(db, { allow_guest_registration: false })
    const client = buildClient(db)

    const result = await attendEvent(client, {
      eventId: EVENT_ID, profileId: PROFILE_ID, profileRole: 'member',
      profileName: 'Ivan Petrov', contactEmail: null,
    })

    expect(result).toEqual({ success: false, error: 'Registration is not available for this event.' })
    expect(db.guest_registrations).toHaveLength(0)
  })
})

// -- Confirmation email (2608-DEV-707) ------------------------------------------

describe('attendEvent — confirmation email', () => {
  const EMAIL = 'ivan@example.com'

  function attend(client: SupabaseClient, over: Partial<Parameters<typeof attendEvent>[1]> = {}) {
    return attendEvent(client, {
      eventId: EVENT_ID, profileId: PROFILE_ID, profileRole: 'member',
      profileName: 'Ivan Petrov', contactEmail: EMAIL,
      ...over,
    })
  }

  it('sends a token-free join URL on a fresh attend', async () => {
    const db = makeDb()
    seedEvent(db)
    const result = await attend(buildClient(db))

    expect(result).toMatchObject({ success: true, emailed: true })
    expect(sendTransactionalEmail).toHaveBeenCalledTimes(1)

    const payload = sendTransactionalEmail.mock.calls[0][0] as unknown as {
      to: string; subject: string; template: string
    }
    expect(payload.to).toBe(EMAIL)
    expect(payload.template).toBe('member_event_confirmation')
    expect(payload.subject).toBe("You're attending: N21 Weekly")

    const props = (renderEmailTemplate.mock.calls[0][0] as unknown as { props: Record<string, unknown> }).props
    expect(props.joinUrl).toBe(`https://portal.example.com/events/${EVENT_ID}/join`)
    expect(props.joinUrl).not.toContain('token')
    expect(props.lang).toBe('en')
    // The label is built off a moving FUTURE fixture, so the assertion is on the
    // locale of the rendering, not on one date: an en email must not carry the
    // bg-BG weekday formatLongDate would give it (2608-DEV-707 review).
    expect(props.eventDateLabel).toMatch(/^[A-Z][a-z]+day, \d{2} [A-Z][a-z]+ \d{4}, \d{2}:\d{2} – \d{2}:\d{2}$/)
  })

  it('renders the bg subject and passes lang through', async () => {
    const db = makeDb()
    seedEvent(db)
    await attend(buildClient(db), { lang: 'bg' })

    const payload = sendTransactionalEmail.mock.calls[0][0] as unknown as { subject: string }
    expect(payload.subject).toBe('Присъствието ви е потвърдено: N21 Weekly')
    const props = (renderEmailTemplate.mock.calls[0][0] as unknown as { props: Record<string, unknown> }).props
    expect(props.lang).toBe('bg')
    // Cyrillic weekday — the bg branch still goes through formatLongDate.
    expect(props.eventDateLabel).toMatch(/^[а-я]+, \d{2}\.\d{2}\.\d{4} г\., \d{2}:\d{2} – \d{2}:\d{2}$/)
  })

  it('sends on a reactivated registration', async () => {
    const db = makeDb()
    seedEvent(db)
    db.guest_registrations.push({
      id: 'reg-1', event_id: EVENT_ID, profile_id: PROFILE_ID, name: 'Ivan Petrov',
      status: 'confirmed', cancelled_at: '2026-08-01T00:00:00.000Z', share_link_id: null,
    })

    const result = await attend(buildClient(db))
    expect(result).toMatchObject({ emailed: true })
    expect(sendTransactionalEmail).toHaveBeenCalledTimes(1)
  })

  it('does not re-send on an already-active idempotent attend', async () => {
    const db = makeDb()
    seedEvent(db)
    db.guest_registrations.push({
      id: 'reg-1', event_id: EVENT_ID, profile_id: PROFILE_ID, name: 'Ivan Petrov',
      status: 'confirmed', cancelled_at: null, share_link_id: null,
    })

    const result = await attend(buildClient(db))
    expect(result).toEqual({ success: true, registrationId: 'reg-1', emailed: false })
    expect(sendTransactionalEmail).not.toHaveBeenCalled()
  })

  it('skips the send silently when contact_email is null — attend still succeeds', async () => {
    const db = makeDb()
    seedEvent(db)

    const result = await attend(buildClient(db), { contactEmail: null })

    expect(result).toMatchObject({ success: true, emailed: false })
    expect(sendTransactionalEmail).not.toHaveBeenCalled()
    expect(consumeEmailCap).not.toHaveBeenCalled()
    expect(db.guest_registrations).toHaveLength(1)
  })

  it('skips the send when the recipient is over the daily cap', async () => {
    const db = makeDb()
    seedEvent(db)
    consumeEmailCap.mockResolvedValue(false)

    const result = await attend(buildClient(db))

    expect(result).toMatchObject({ success: true, emailed: false })
    expect(sendTransactionalEmail).not.toHaveBeenCalled()
    expect(db.guest_registrations).toHaveLength(1)
  })

  it('reports emailed:false but still succeeds when the send fails', async () => {
    const db = makeDb()
    seedEvent(db)
    sendTransactionalEmail.mockResolvedValue({ sent: false })

    const result = await attend(buildClient(db))

    expect(result).toMatchObject({ success: true, emailed: false })
    expect(db.guest_registrations).toHaveLength(1)
  })

  it('never fails the attend when the link builder throws (#713 shape)', async () => {
    const db = makeDb()
    seedEvent(db)
    getBaseUrl.mockRejectedValue(new Error('NEXT_PUBLIC_APP_URL is not set.'))

    const result = await attend(buildClient(db))

    // The registration is already committed at this point — a broken base URL
    // must not turn it into an error response for the caller.
    expect(result).toMatchObject({ success: true, emailed: false })
    expect(db.guest_registrations).toHaveLength(1)
    expect(sendTransactionalEmail).not.toHaveBeenCalled()
  })
})

// -- cancelMemberRegistration -----------------------------------------------------

describe('cancelMemberRegistration', () => {
  it('errors when the caller has no registration for the event', async () => {
    const db = makeDb()
    const client = buildClient(db)

    const result = await cancelMemberRegistration(client, { eventId: EVENT_ID, profileId: PROFILE_ID })
    expect(result).toEqual({ success: false, error: 'Not registered for this event.' })
  })

  it('is idempotent on an already-cancelled registration', async () => {
    const db = makeDb()
    db.guest_registrations.push({
      id: 'reg-1', event_id: EVENT_ID, profile_id: PROFILE_ID, name: 'Ivan Petrov',
      cancelled_at: '2026-08-01T00:00:00.000Z', share_link_id: 'link-1',
    })
    const client = buildClient(db)

    const result = await cancelMemberRegistration(client, { eventId: EVENT_ID, profileId: PROFILE_ID })
    expect(result).toEqual({ success: true })
    expect(notifySharerOfCancellation).not.toHaveBeenCalled()
  })

  it('soft-cancels an active registration and notifies the sharer', async () => {
    const db = makeDb()
    db.guest_registrations.push({
      id: 'reg-1', event_id: EVENT_ID, profile_id: PROFILE_ID, name: 'Ivan Petrov',
      cancelled_at: null, share_link_id: 'link-1',
    })
    const client = buildClient(db)

    const result = await cancelMemberRegistration(client, { eventId: EVENT_ID, profileId: PROFILE_ID })
    expect(result).toEqual({ success: true })
    expect(db.guest_registrations[0].cancelled_at).not.toBeNull()
    expect(notifySharerOfCancellation).toHaveBeenCalledWith('link-1', 'Ivan Petrov')
  })
})
