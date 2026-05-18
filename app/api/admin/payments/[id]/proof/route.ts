import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  // Admin check via profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_id', userId)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch payment — no ownership restriction for admin
  const { data: payment } = await supabase
    .from('payments')
    .select('id, proof_url')
    .eq('id', id)
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
