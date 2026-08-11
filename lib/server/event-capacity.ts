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
 * Three round trips, because PostgREST cannot express
 * `profile_id NOT IN (SELECT …)` in one query: read the approved holders, then
 * subtract their active registrations from the total.
 *
 * Both registration reads are `count: 'exact', head: true` rather than a row
 * fetch counted in TypeScript. That is load-bearing: `supabase/config.toml:14`
 * sets `max_rows = 1000`, which caps rows RETURNED but never applied to a count
 * query. Counting fetched rows would silently saturate at 1000, so an event
 * with `guest_capacity >= 1000` would stop enforcing capacity entirely.
 *
 * Since 2608-DEV-718 this is the FAST PATH, not the enforcement point. It runs
 * before the write to produce the friendly localized "event is full" copy, but
 * it is still a read-then-write and cannot close the window between the two.
 * The hard guard is `trg_enforce_event_guest_capacity`
 * (20260811000100_2608_fix_718_guest_capacity_trigger.sql), which repeats this
 * count under an advisory lock inside the writing transaction. Keep the two
 * definitions of "who occupies a seat" in step — the role-holder exclusion
 * below is mirrored in the trigger body.
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

  // 2. All active registrations on this event.
  const { count: totalActive, error: regError } = await supabase
    .from('guest_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .is('cancelled_at', null)

  // Matches the pre-existing `(count ?? 0)` behaviour of the three call sites
  // this helper replaced: an unreadable registration table counts as zero
  // rather than blocking every registration on the event.
  if (regError) {
    console.error('Failed to count active registrations for capacity:', regError)
    return 0
  }

  const total = totalActive ?? 0
  if (roleHolderIds.size === 0) return total

  // 3. How many of those belong to an approved role holder. Bounded by the
  // event's role slots, so the .in() list stays small.
  const { count: roleHolderActive, error: roleRegError } = await supabase
    .from('guest_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .is('cancelled_at', null)
    .in('profile_id', Array.from(roleHolderIds))

  // Subtracting nothing is the strict answer — it can only over-count, never
  // let an over-capacity registration through.
  if (roleRegError) {
    console.error('Failed to count role-holder registrations for capacity:', roleRegError)
    return total
  }

  return Math.max(0, total - (roleHolderActive ?? 0))
}

/**
 * 2608-DEV-718 — did this write fail because the event is full?
 *
 * `trg_enforce_event_guest_capacity` raises SQLSTATE `P0718` and nothing else
 * does. Deliberately NOT one of the 23xxx integrity codes: `guest_registrations`
 * carries real CHECK and UNIQUE constraints of its own, so matching a shared
 * class would report an unrelated violation to the guest as "event is full".
 *
 * Every write that can seat a registrant must route its error through this, or
 * a genuine capacity refusal reaches the user as "Registration failed. Please
 * try again." — copy that invites a retry which can never succeed.
 */
export const CAPACITY_VIOLATION_CODE = 'P0718'

export function isCapacityViolation(error: { code?: string } | null | undefined): boolean {
  return error?.code === CAPACITY_VIOLATION_CODE
}
