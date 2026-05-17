import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { paymentId } = await params
  const supabase = createServiceClient()

  // Single query: fetch payment and verify ownership via join on profiles.
  // payments has two FKs to profiles (profile_id, logged_by_admin) —
  // !profile_id disambiguates to the ownership FK.
  const { data: payment } = await supabase
    .from('payments')
    .select('id, proof_url, profiles!profile_id(clerk_id)')
    .eq('id', paymentId)
    .eq('profiles.clerk_id', userId)
    .single()

  if (!payment || !payment.proof_url) {
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
