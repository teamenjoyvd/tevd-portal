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
    allow_guest_registration: true,
    end_time: FUTURE,
    guest_capacity: null,
    ...over,
  })
}

beforeEach(() => {
  notifySharerOfRegistration.mockClear()
  notifySharerOfCancellation.mockClear()
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

    expect(result).toEqual({ success: true, registrationId: 'reg-1' })
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

    expect(result).toEqual({ success: true, registrationId: 'reg-1' })
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

    expect(result).toEqual({ success: true, registrationId: 'guest-reg-1' })
    expect(db.guest_registrations).toHaveLength(1)
    expect(db.guest_registrations[0]).toMatchObject({
      profile_id: PROFILE_ID, email: null, token: null, expires_at: null,
      cancelled_at: null, status: 'confirmed', name: 'Ivan Petrov',
    })
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

    expect(result).toEqual({ success: true, registrationId: 'reg-1' })
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
