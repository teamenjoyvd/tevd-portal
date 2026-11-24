import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The one place that decides who gets calendar_events.meeting_url (2608-DEV-760).
 * Copied for Deno in supabase/functions/_shared/ticketed-event.ts: change both.
 */

type EventIdentity = { id: string; source: string; series_key: string | null }

/**
 * A ticketed event is reached only through a personal link per admission.
 * `source` alone does not decide it: since 2608-DEV-764 every admin-created
 * event is 'portal', so a portal event also needs a product. An inactive
 * product counts, because passes sold earlier stay valid.
 *
 * Fails closed: if the lookup fails the event counts as ticketed.
 */
export async function isTicketedEvent(supabase: SupabaseClient, event: EventIdentity): Promise<boolean> {
  if (event.source === 'zoom') return true
  if (event.source !== 'portal') return false
  const product = (column: 'event_id' | 'series_key', value: string) =>
    supabase.from('ticket_products').select('id').eq(column, value).limit(1)
  const results = await Promise.all([
    product('event_id', event.id),
    ...(event.series_key === null ? [] : [product('series_key', event.series_key)]),
  ])
  return results.some((r) => r.error !== null || r.data.length > 0)
}

/** The event's shared link, or null on a ticketed event. For surfaces that already checked the registration. */
export async function sharedMeetingUrl(
  supabase: SupabaseClient,
  event: EventIdentity & { meeting_url: string | null },
): Promise<string | null> {
  if (event.meeting_url === null) return null
  return (await isTicketedEvent(supabase, event)) ? null : event.meeting_url
}

/**
 * D3 gating rule: who may see calendar_events.meeting_url.
 *
 * `allow_guest_registration` is NOT NULL DEFAULT false (20260410000001:6), so
 * the gate applies only to events explicitly opened for guest sharing.
 * Ordinary internal events keep today's behaviour (link always visible to
 * non-guests).
 */
export function canSeeMeetingUrl(a: {
  role: string
  allowGuestRegistration: boolean
  hasActiveRegistration: boolean
}): boolean {
  if (a.role === 'guest') return false                  // anonymous/guest: never
  if (a.role === 'admin') return true                    // admin: always
  if (a.allowGuestRegistration !== true) return true      // legacy behaviour preserved
  return a.hasActiveRegistration
}
