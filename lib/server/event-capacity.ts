import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 2608-DEV-710 (D10) — the headcount that `calendar_events.guest_capacity` is
 * compared against.
 *
 * Approved role holders (HOST / SPEAKER / PRODUCTS) are staff, not attendees:
 * counting them would let a well-staffed event lock out the very guests it
 * exists to attract. Since 2608-DEV-710 an approval writes a
 * `guest_registrations` row of its own (D2), so excluding them here is what
 * keeps `guest_capacity` meaning "seats for attendees".
 *
 * Lives in `lib/server/` rather than in `lib/actions/guest-registration.ts`
 * because that module is `'use server'` — anything exported from it becomes a
 * server-action endpoint.
 *
 * Two round trips with the filtering done in TypeScript: PostgREST cannot
 * express `profile_id NOT IN (SELECT …)`, and `.or('profile_id.is.null,…')`
 * would be a single query that the unit-test fakes cannot drive (their query
 * builders implement `eq`/`is` only).
 *
 * Note: this moves the existing read-then-write capacity shape, it does not
 * close the TOCTOU race tracked by #718 — there is still no DB-level guard on
 * `guest_capacity`.
 */
export async function countAttendeesForCapacity(
  supabase: SupabaseClient,
  eventId: string,
): Promise<number> {
  // 1. Profiles holding an approved role on this event.
  const { data: roleRows, error: roleError } = await supabase
    .from('event_role_requests')
    .select('profile_id')
    .eq('event_id', eventId)
    .eq('status', 'approved')

  // A failed exclusion lookup must not silently open the gate: fall through
  // with an empty set, which counts role holders IN and so can only be
  // stricter than intended, never looser.
  if (roleError) console.error('Failed to load approved role holders for capacity:', roleError)

  const roleHolderIds = new Set(
    (roleRows ?? [])
      .map(r => (r as { profile_id: string | null }).profile_id)
      .filter((id): id is string => id !== null),
  )

  // 2. Active registrations on this event.
  const { data: regRows, error: regError } = await supabase
    .from('guest_registrations')
    .select('profile_id')
    .eq('event_id', eventId)
    .is('cancelled_at', null)

  // Matches the pre-existing `(count ?? 0)` behaviour of the three call sites
  // this helper replaced: an unreadable registration table counts as zero
  // rather than blocking every registration on the event.
  if (regError) {
    console.error('Failed to count active registrations for capacity:', regError)
    return 0
  }

  return (regRows ?? []).filter(r => {
    const profileId = (r as { profile_id: string | null }).profile_id
    return profileId === null || !roleHolderIds.has(profileId)
  }).length
}
