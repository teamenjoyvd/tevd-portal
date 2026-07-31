import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerProfile } from '@/lib/supabase/guards'
import { requireAuth } from '@/lib/supabase/with-profile'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const authCtx = await requireAuth()
  if (authCtx.response) return authCtx.response
  const { userId } = authCtx

  const { id } = await params
  const supabase = createServiceClient()

  // 2607-DEV-676 narrows this to the PAYER only. A beneficiary can see that the
  // payment exists, but must not open the image: a bank-transfer screenshot
  // routinely shows the payer's account number and balance, and on a group
  // payment the payer is a different person from the row's owner.
  //
  // The embedded-filter join this replaced could not express that rule, since
  // the answer now depends on two columns. Comparing explicitly in TS is also
  // why the IDOR hazard the old comment warned about does not apply: the
  // ownership test is a plain equality on values we fetched, not a nested
  // filter that silently leaves the top-level row in place. `payments` now has
  // THREE FKs to profiles, so any future embed here must be hinted.
  const profile = await getCallerProfile(userId, supabase)
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: payment } = await supabase
    .from('payments')
    .select('id, proof_url, profile_id, paid_by_profile_id')
    .eq('id', id)
    .single()

  // Legacy/self-paid rows have paid_by_profile_id NULL and the payer is
  // profile_id; group rows name the payer explicitly. `??` not `||`, per the
  // zero-is-data rule — and so an empty string could never fall through.
  const payerId = payment?.paid_by_profile_id ?? payment?.profile_id ?? null

  if (!payment || !payment.proof_url || payerId !== profile.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Generate short-lived signed download URL (1 hour)
  const { data: signed, error } = await supabase.storage
    .from('trip-proofs')
    .createSignedUrl(payment.proof_url, 3600)

  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: 'Could not generate download URL' }, { status: 500 })
  }

  return NextResponse.redirect(signed.signedUrl, 302)
}
