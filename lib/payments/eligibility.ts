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

export type BeneficiaryRelation = 'self' | 'household' | 'downline' | 'guest'

export type PayableBeneficiary = {
  profile_id: string
  first_name: string
  last_name: string
  abo_number: string | null
  role: string
  relation: BeneficiaryRelation
}

/** Matches the cap asserted inside submit_payment_group. */
export const MAX_BENEFICIARIES = 20

type Client = SupabaseClient<Database>

/**
 * Everyone `payerProfileId` may pay for, ordered self -> household -> downline
 * -> guest by the RPC. Returns [] when the RPC errors, never throws: the picker
 * degrades to "only yourself" rather than breaking the payment form.
 */
export async function fetchPayableBeneficiaries(
  supabase: Client,
  payerProfileId: string,
): Promise<{ beneficiaries: PayableBeneficiary[]; error: string | null }> {
  const { data, error } = await supabase.rpc('get_payable_beneficiaries', {
    p_viewer: payerProfileId,
  })

  if (error) return { beneficiaries: [], error: error.message }
  return { beneficiaries: (data ?? []) as PayableBeneficiary[], error: null }
}

export type GroupCheck =
  | { ok: true }
  | { ok: false; status: 400 | 403; error: string }

/**
 * Validates a requested set of beneficiary ids against the payer's eligible set
 * in ONE round trip — fetch the set once, compare in memory — rather than one
 * `can_pay_for` call per beneficiary.
 *
 * Rejects an unknown id with 403 and never names which id was rejected in a way
 * that would confirm the profile exists: the caller may be probing.
 */
export async function assertGroupAllowed(
  supabase: Client,
  payerProfileId: string,
  beneficiaryIds: readonly string[],
): Promise<GroupCheck> {
  if (beneficiaryIds.length === 0) {
    return { ok: false, status: 400, error: 'At least one beneficiary is required' }
  }
  if (beneficiaryIds.length > MAX_BENEFICIARIES) {
    return {
      ok: false,
      status: 400,
      error: `At most ${MAX_BENEFICIARIES} beneficiaries are allowed per payment`,
    }
  }
  if (new Set(beneficiaryIds).size !== beneficiaryIds.length) {
    return { ok: false, status: 400, error: 'A beneficiary may appear only once per payment' }
  }

  const { beneficiaries, error } = await fetchPayableBeneficiaries(supabase, payerProfileId)
  if (error) return { ok: false, status: 403, error: 'Could not verify beneficiaries' }

  const allowed = new Set(beneficiaries.map((b) => b.profile_id))
  if (beneficiaryIds.some((id) => !allowed.has(id))) {
    return { ok: false, status: 403, error: 'One or more beneficiaries are not in your team' }
  }

  return { ok: true }
}
