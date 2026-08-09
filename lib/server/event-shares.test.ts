import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchEventShares, type EventShareGuest } from './event-shares'

// Unit coverage for the guest-filter mapper in fetchEventShares (issue
// 2608-DEV-705). The hazard this guards: guest_registrations.email became
// nullable so the table can also hold MEMBER registrations, and the mapper
// runs string methods over every nested guest row. A member row (email: null)
// must flow through the status derivation and the name search untouched —
// `name` stays NOT NULL precisely so this code can keep calling
// .toLowerCase() on it unguarded.

// -- Seams --------------------------------------------------------------------

type RawLink = {
  id: string
  token: string
  share_method: string
  click_count: number
  created_at: string
  revoked_at: string | null
  event: { id: string; title: string; start_time: string } | null
  guests: EventShareGuest[]
}

/**
 * Minimal thenable stand-in for the PostgREST query builder: every filter
 * method returns `this`, and awaiting the builder resolves the fixed result.
 */
function buildClient(links: RawLink[]) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    lte: () => builder,
    order: () => builder,
    then: (resolve: (v: { data: RawLink[]; error: null }) => unknown) =>
      resolve({ data: links, error: null }),
  }
  return { from: () => builder } as unknown as SupabaseClient
}

function guest(over: Partial<EventShareGuest> & { id: string; name: string }): EventShareGuest {
  return {
    email: 'guest@example.com',
    status: 'pending',
    attended_at: null,
    cancelled_at: null,
    created_at: '2026-08-01T10:00:00.000Z',
    ...over,
  }
}

/** A member registration: no email, no token, no expiry — 2608-DEV-705 shape. */
const memberRow = guest({ id: 'm1', name: 'Ivan Petrov', email: null, status: 'confirmed' })
const guestRow = guest({ id: 'g1', name: 'Външен Гост', email: 'ext@example.com' })

function link(guests: EventShareGuest[], revoked_at: string | null = null): RawLink {
  return {
    id: 'l1',
    token: 'tok',
    share_method: 'native',
    click_count: 3,
    created_at: '2026-08-01T09:00:00.000Z',
    revoked_at,
    event: { id: 'e1', title: 'Trip Kickoff', start_time: '2026-09-01T18:00:00.000Z' },
    guests,
  }
}

async function run(links: RawLink[], filters = {}) {
  const { data, error } = await fetchEventShares(buildClient(links), 'p1', filters)
  expect(error).toBeNull()
  return data!
}

// -- Tests --------------------------------------------------------------------

describe('fetchEventShares — member rows (email: null)', () => {
  it('passes a member row through the mapper without throwing', async () => {
    const data = await run([link([memberRow, guestRow])])
    expect(data[0].guests.map(g => g.id)).toEqual(['m1', 'g1'])
    expect(data[0].guests[0].email).toBeNull()
  })

  it('derives status for a member row from attended_at/cancelled_at/status, not email', async () => {
    const attended = guest({ id: 'm2', name: 'Attended Member', email: null, attended_at: '2026-09-01T19:00:00.000Z' })
    const cancelled = guest({ id: 'm3', name: 'Cancelled Member', email: null, cancelled_at: '2026-08-20T12:00:00.000Z' })
    const pending = guest({ id: 'm4', name: 'Pending Member', email: null })

    expect((await run([link([attended])], { status: 'attended' }))[0].guests).toHaveLength(1)
    expect((await run([link([cancelled])], { status: 'cancelled' }))[0].guests).toHaveLength(1)
    expect((await run([link([memberRow])], { status: 'confirmed' }))[0].guests).toHaveLength(1)
    expect((await run([link([pending])], { status: 'pending' }))[0].guests).toHaveLength(1)
  })

  it('treats a member row on a revoked link as cancelled, same as a guest row', async () => {
    const data = await run([link([memberRow, guestRow], '2026-08-05T00:00:00.000Z')], { status: 'cancelled' })
    // memberRow is status 'confirmed' — confirmed outranks link revocation.
    expect(data[0].guests.map(g => g.id)).toEqual(['g1'])
  })

  it('matches a member row by name search even though email is null', async () => {
    const data = await run([link([memberRow, guestRow])], { q: 'ivan' })
    expect(data[0].guests.map(g => g.id)).toEqual(['m1'])
  })

  it('excludes non-matching rows without dereferencing email', async () => {
    const data = await run([link([memberRow, guestRow])], { q: 'nobody' })
    expect(data[0].guests).toHaveLength(0)
  })
})
