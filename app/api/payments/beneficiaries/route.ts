import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerProfile } from '@/lib/supabase/guards'
import { fetchPayableBeneficiaries, fetchPayableGuests } from '@/lib/payments/eligibility'

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
 * Guest-role callers get themselves only, matching POST /api/payments, which
 * 403s them.
 *
 * Merged on top of that (2607-DEV-677): the caller's own remembered ad-hoc
 * guests — people with no account at all — as `kind: 'guest'` entries carrying
 * their real `payment_guests.id`, so paying for the same friend a second time
 * submits an id and re-types nothing. They are appended AFTER the profile rows
 * because the RPC's ordering (self -> household -> downline -> guest) is the
 * picker's section order and ad-hoc people sort last.
 */
export async function GET(): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const profile = await getCallerProfile(userId, supabase)
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const { beneficiaries, error } = await fetchPayableBeneficiaries(supabase, profile.id)
  if (error) return Response.json({ error }, { status: 500 })

  // A guest-role caller may only ever pay for themselves, so they get no guest
  // list: offering them one would invite a submission POST /api/payments rejects.
  if (profile.role === 'guest') return Response.json(beneficiaries)

  const { guests, error: guestError } = await fetchPayableGuests(supabase, profile.id)
  if (guestError) return Response.json({ error: guestError }, { status: 500 })

  return Response.json([...beneficiaries, ...guests])
}
