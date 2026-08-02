import type { MemberProfile, MembersResponse } from '@/lib/types/payments'

/**
 * One de-duplicated, name-sorted list of members from `/api/admin/members`.
 *
 * Hoisted out of LogPaymentDrawer so GuestLinkPanel can reuse it alongside the
 * `['admin-members']` react-query key. The two components then share one cache
 * entry and one definition of "the member list" — the array itself was never
 * reusable, because it was computed inside a `useMemo` in a drawer that only
 * fetches while open.
 *
 * A member can appear in both halves of the response (an LOS row and a manual
 * no-ABO row); first occurrence wins, so the ABO-carrying one is kept.
 */
export function dedupeMembers(data: MembersResponse | undefined): MemberProfile[] {
  if (!data) return []

  const seen = new Set<string>()
  const out: MemberProfile[] = []

  for (const m of data.los_members ?? []) {
    if (m.profile && !seen.has(m.profile.id)) {
      seen.add(m.profile.id)
      out.push(m.profile)
    }
  }
  for (const m of data.manual_members_no_abo ?? []) {
    if (!seen.has(m.id)) {
      seen.add(m.id)
      out.push({ id: m.id, first_name: m.first_name, last_name: m.last_name, abo_number: null })
    }
  }

  return out.sort((a, b) => a.last_name.localeCompare(b.last_name))
}
