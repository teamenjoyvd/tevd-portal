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

  // Resolve caller profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_id', userId)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch payment — ownership enforced: profile_id must match caller
  const { data: payment } = await supabase
    .from('payments')
    .select('id, proof_url, profile_id')
    .eq('id', paymentId)
    .eq('profile_id', profile.id)
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
