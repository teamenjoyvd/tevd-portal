import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

/**
 * Who a payer may submit a payment for (2607-DEV-676).
 *
 * There is exactly one definition of eligibility and it lives in SQL —
 * `get_payable_beneficiaries`. This module is a typed wrapper over it, used by
 * the picker route and by the pre-flight check in POST /api/payments. It is NOT
 * the security boundary: every server route runs under the service client with
 * RLS bypassed (ADR-002/011), so `submit_payment_group` re-runs `can_pay_for`
 * inside the write transaction. Checking here as well is what turns a bypass
 * attempt into a clean 403 instead of a raw Postgres error.
 */

/**
 * `guest` here means an ABO-less APPROVED MEMBER (#676) — someone with a real
 * profiles row. Ad-hoc people with no account at all (2607-DEV-677) are a
 * different thing entirely and carry `external`; the two are never merged.
 */
export type BeneficiaryRelation = 'self' | 'household' | 'downline' | 'guest' | 'external'

export type PayableProfile = {
  kind: 'profile'
  profile_id: string
  first_name: string
  last_name: string
  abo_number: string | null
  role: string
  relation: Exclude<BeneficiaryRelation, 'external'>
}

/** A remembered ad-hoc guest of this payer — no profiles row, no ledger. */
export type PayableGuest = {
  kind: 'guest'
  guest_id: string
  name: string
  email: string | null
  relation: 'external'
}

/** One row of GET /api/payments/beneficiaries, discriminated on `kind`. */
export type PayableBeneficiary = PayableProfile | PayableGuest

/** Matches the cap asserted inside submit_payment_group. */
export const MAX_BENEFICIARIES = 20

/**
 * Kept in step with payment_guests_name_check / payment_guests_email_check in
 * 20260801000000_2607_feat_677_pay_guests.sql. A value the form accepts but the
 * database rejects is a dead end for the user.
 */
export const MAX_GUEST_NAME_LENGTH = 120
export const MAX_GUEST_EMAIL_LENGTH = 254

/**
 * The identity a guest is remembered by — (owner, case-folded trimmed name,
 * case-folded email, empty when absent) — matching what
 * `uq_payment_guests_owner_identity` indexes. Re-typing "  ivan petrov " must
 * reuse the row created for "Ivan Petrov", not create a second one.
 *
 * The two normalizations are NOT the same function: JS `trim()` strips the full
 * ECMAScript whitespace set (tabs, NBSP, line terminators), while SQL `btrim()`
 * with no argument strips the ASCII space only. They agree because the DB never
 * sees an untrimmed name: POST /api/payments rebuilds every inline guest as
 * `String(...).trim()` before the RPC (app/api/payments/route.ts:145-146), and
 * `submit_payment_group` is service_role-only with that route as its sole
 * caller. Any NEW caller of the RPC must trim in JS first, or "Ivan" and
 * "Ivan\t" will be remembered as two different people.
 *
 * JSON-encoded rather than joined on a separator character: a name may contain
 * any character a user can type, so any plain delimiter admits a collision
 * (`"a|b" + ""` vs `"a" + "b"`).
 */
export function guestIdentityKey(name: string, email?: string | null): string {
  return JSON.stringify([name.trim().toLowerCase(), (email ?? '').trim().toLowerCase()])
}

type Client = SupabaseClient<Database>

/**
 * Everyone `payerProfileId` may pay for, ordered self -> household -> downline
 * -> guest by the RPC. Returns [] when the RPC errors, never throws: the picker
 * degrades to "only yourself" rather than breaking the payment form.
 */
export async function fetchPayableBeneficiaries(
  supabase: Client,
  payerProfileId: string,
): Promise<{ beneficiaries: PayableProfile[]; error: string | null }> {
  const { data, error } = await supabase.rpc('get_payable_beneficiaries', {
    p_viewer: payerProfileId,
  })

  if (error) return { beneficiaries: [], error: error.message }

  // `kind` is added here rather than in SQL: get_payable_beneficiaries is the
  // pure statement of LOS eligibility and 2607-DEV-677 deliberately left it
  // untouched. The discriminator belongs to the wire shape, not the RPC.
  const rows = (data ?? []) as Omit<PayableProfile, 'kind'>[]
  return { beneficiaries: rows.map((row) => ({ ...row, kind: 'profile' as const })), error: null }
}

/**
 * The payer's remembered ad-hoc guests (2607-DEV-677), merged into the picker
 * alongside the profile beneficiaries above. Private to their owner: this is
 * the only query, and it is always scoped by `owner_profile_id`.
 *
 * Same failure contract as fetchPayableBeneficiaries — never throws, so a
 * broken guest lookup degrades the picker to profiles-only instead of breaking
 * the payment form.
 */
export async function fetchPayableGuests(
  supabase: Client,
  ownerProfileId: string,
): Promise<{ guests: PayableGuest[]; error: string | null }> {
  const { data, error } = await supabase
    .from('payment_guests')
    .select('id, name, email')
    .eq('owner_profile_id', ownerProfileId)
    .order('name', { ascending: true })

  if (error) return { guests: [], error: error.message }

  return {
    guests: (data ?? []).map((row) => ({
      kind: 'guest' as const,
      guest_id: row.id,
      name: row.name,
      email: row.email,
      relation: 'external' as const,
    })),
    error: null,
  }
}

export type GroupCheck =
  | { ok: true }
  | { ok: false; status: 400 | 403; error: string }

/**
 * One beneficiary of a submission, exactly as the client sends it: a profile, a
 * guest this payer already knows, or a guest to be created inline. Mirrors the
 * three entry shapes submit_payment_group accepts.
 */
export type GroupEntry = {
  profile_id?: string | null
  guest_id?: string | null
  /**
   * `unknown` rather than `string`, because this shape arrives straight off
   * `await req.json()` and is only ASSERTED to be well-formed here. Typing the
   * fields as strings would let the compiler bless `.trim()` on a value that is
   * a number at runtime — see the coercion check in assertGroupAllowed.
   */
  guest?: { name?: unknown; email?: unknown } | null
}

/**
 * Validates a requested set of beneficiaries — profiles, known guests, inline
 * guests — against what this payer is actually allowed to submit.
 *
 * At most two round trips regardless of size: the eligible profile set and the
 * payer's guest list are each fetched ONCE and compared in memory, rather than
 * one `can_pay_for` call per beneficiary. Neither is fetched when no entry of
 * that kind is present.
 *
 * Rejects an unknown id with 403 and never names which id was rejected in a way
 * that would confirm the profile or guest exists: the caller may be probing.
 *
 * NOT the security boundary — `submit_payment_group` re-checks everything inside
 * the write transaction, where RLS being bypassed cannot matter. This exists so
 * a hand-crafted request gets a clean, specific error instead of a raw Postgres
 * one, and so the form can never offer something the database will refuse.
 */
export async function assertGroupAllowed(
  supabase: Client,
  payerProfileId: string,
  entries: readonly GroupEntry[],
): Promise<GroupCheck> {
  if (entries.length === 0) {
    return { ok: false, status: 400, error: 'At least one beneficiary is required' }
  }
  if (entries.length > MAX_BENEFICIARIES) {
    return {
      ok: false,
      status: 400,
      error: `At most ${MAX_BENEFICIARIES} beneficiaries are allowed per payment`,
    }
  }

  const profileIds: string[] = []
  const guestIds: string[] = []
  const inlineGuests: { name: string; email: string | null }[] = []

  for (const entry of entries) {
    const kinds =
      (typeof entry?.profile_id === 'string' ? 1 : 0) +
      (typeof entry?.guest_id === 'string' ? 1 : 0) +
      (entry?.guest != null ? 1 : 0)
    if (kinds !== 1) {
      return {
        ok: false,
        status: 400,
        error: 'Each beneficiary needs exactly one of profile_id, guest_id or guest',
      }
    }

    if (typeof entry.profile_id === 'string') {
      profileIds.push(entry.profile_id)
      continue
    }
    if (typeof entry.guest_id === 'string') {
      guestIds.push(entry.guest_id)
      continue
    }

    // Type-checked BEFORE any string method touches them. These values come off
    // `await req.json()` untouched (app/api/payments/route.ts:51), so they carry
    // whatever JSON type the caller sent, and `??` substitutes only null and
    // undefined — `(123).trim()` would throw a TypeError out of a handler with
    // no try/catch, turning a bad request into a 500 any member could provoke.
    // Rejected rather than coerced: `String(123)` would silently remember a
    // guest named "123", and the route's own String(...) rebuild at :145 runs
    // only after this check passes.
    const rawName = entry.guest?.name ?? ''
    const rawEmail = entry.guest?.email ?? ''
    if (typeof rawName !== 'string' || typeof rawEmail !== 'string') {
      return { ok: false, status: 400, error: 'A guest name and email must be text' }
    }

    const name = rawName.trim()
    if (name.length === 0 || name.length > MAX_GUEST_NAME_LENGTH) {
      return {
        ok: false,
        status: 400,
        error: `A guest needs a name of 1 to ${MAX_GUEST_NAME_LENGTH} characters`,
      }
    }
    const email = rawEmail.trim()
    if (email.length > MAX_GUEST_EMAIL_LENGTH) {
      return {
        ok: false,
        status: 400,
        error: `A guest email may be at most ${MAX_GUEST_EMAIL_LENGTH} characters`,
      }
    }
    inlineGuests.push({ name, email: email.length > 0 ? email : null })
  }

  if (profileIds.length > 0) {
    const { beneficiaries, error } = await fetchPayableBeneficiaries(supabase, payerProfileId)
    if (error) return { ok: false, status: 403, error: 'Could not verify beneficiaries' }

    const allowed = new Set(beneficiaries.map((b) => b.profile_id))
    if (profileIds.some((id) => !allowed.has(id))) {
      return { ok: false, status: 403, error: 'One or more beneficiaries are not in your team' }
    }
  }

  // Resolve every guest entry — named or inline — to the identity it will end up
  // sharing, so that "Ivan by id" and "Ivan re-typed" collide here with a clean
  // 400 instead of reaching the RPC's post-resolution uniqueness check.
  const guestKeys: string[] = []
  if (guestIds.length > 0 || inlineGuests.length > 0) {
    const { guests, error } = await fetchPayableGuests(supabase, payerProfileId)
    if (error) return { ok: false, status: 403, error: 'Could not verify guests' }

    const byId = new Map(guests.map((g) => [g.guest_id, g]))
    if (guestIds.some((id) => !byId.has(id))) {
      // Same reticence as the profile branch: never confirm that an id exists.
      return { ok: false, status: 403, error: 'One or more guests are not yours' }
    }

    const knownByKey = new Map(guests.map((g) => [guestIdentityKey(g.name, g.email), g.guest_id]))
    for (const id of guestIds) guestKeys.push(`g:${id}`)
    for (const guest of inlineGuests) {
      const key = guestIdentityKey(guest.name, guest.email)
      // An inline guest that already exists resolves to the SAME row the RPC
      // will find, so compare it under that row's id — not under its typed text.
      const known = knownByKey.get(key)
      guestKeys.push(known ? `g:${known}` : `new:${key}`)
    }
  }

  const keys = [...profileIds.map((id) => `p:${id}`), ...guestKeys]
  if (new Set(keys).size !== keys.length) {
    return { ok: false, status: 400, error: 'A beneficiary may appear only once per payment' }
  }

  return { ok: true }
}
