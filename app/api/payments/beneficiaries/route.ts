import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerProfile } from '@/lib/supabase/guards'
import { fetchPayableBeneficiaries } from '@/lib/payments/eligibility'

export const dynamic = 'force-dynamic'

/**
 * The beneficiary picker's only source (2607-DEV-676).
 *
 * Returns everyone the caller may submit a payment for — self, household
 * co-owner, strict LOS downline, ABO-less approved members beneath them — as
 * defined once by the `get_payable_beneficiaries` RPC. Because the picker and
 * the write path read the same definition, "the UI offered someone the API then
 * rejects" cannot happen.
 *
 * Guests get themselves only, matching POST /api/payments, which 403s them.
 */
export async function GET(): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const profile = await getCallerProfile(userId, supabase)
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const { beneficiaries, error } = await fetchPayableBeneficiaries(supabase, profile.id)
  if (error) return Response.json({ error }, { status: 500 })

  return Response.json(beneficiaries)
}
