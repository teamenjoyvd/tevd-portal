import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isTicketedEvent, sharedMeetingUrl } from './meeting-url-visibility'
import { isTicketedEvent as isTicketedDeno } from '../../supabase/functions/_shared/ticketed-event'

const db = (products: Record<string, string | null>[], error: unknown = null) =>
  ({
    from: () => ({
      select: () => ({
        eq: (c: string, v: string) => ({
          limit: async () => (error !== null ? { data: null, error } : { data: products.filter((p) => p[c] === v), error: null }),
        }),
      }),
    }),
  }) as unknown as SupabaseClient

const event = (source: string, series_key: string | null = null) => ({ id: 'e1', source, series_key, meeting_url: 'https://meet' })

// Both copies must agree on every row.
describe.each([
  ['app', isTicketedEvent],
  ['edge function', isTicketedDeno as unknown as typeof isTicketedEvent],
])('isTicketedEvent (%s)', (_name, ticketed) => {
  it.each([
    ['zoom, no product', event('zoom'), [], true],
    ['google', event('google'), [], false],
    ['google even with a product', event('google', 'tuesday'), [{ series_key: 'tuesday' }], false],
    ['ordinary portal event', event('portal'), [], false],
    ['portal in a series without products', event('portal', 'x'), [{ series_key: 'tuesday' }], false],
    ['portal with its own product', event('portal'), [{ event_id: 'e1' }], true],
    ['portal in a ticketed series', event('portal', 'tuesday'), [{ series_key: 'tuesday' }], true],
    ['another event’s product', event('portal'), [{ event_id: 'e2' }], false],
  ])('%s', async (_label, e, products, expected) => {
    expect(await ticketed(db(products), e)).toBe(expected)
  })

  it('fails closed', async () => {
    expect(await ticketed(db([], { message: 'down' }), event('portal'))).toBe(true)
  })
})

describe('sharedMeetingUrl', () => {
  it('keeps the link of an unticketed event and drops it on a ticketed one', async () => {
    expect(await sharedMeetingUrl(db([]), event('google'))).toBe('https://meet')
    expect(await sharedMeetingUrl(db([]), event('portal'))).toBe('https://meet')
    expect(await sharedMeetingUrl(db([]), event('zoom'))).toBeNull()
    expect(await sharedMeetingUrl(db([{ event_id: 'e1' }]), event('portal'))).toBeNull()
  })
})
