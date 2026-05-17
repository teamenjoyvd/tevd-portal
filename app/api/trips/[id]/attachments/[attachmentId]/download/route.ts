import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { id: tripId, attachmentId } = await params

  // Resolve profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('clerk_id', userId)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Admins bypass the registration gate
  if (profile.role !== 'admin') {
    const { data: reg } = await supabase
      .from('trip_registrations')
      .select('id')
      .eq('trip_id', tripId)
      .eq('profile_id', profile.id)
      .eq('status', 'approved')
      .maybeSingle()

    if (!reg) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const { data: attachment } = await supabase
    .from('trip_attachments')
    .select('id, file_url')
    .eq('id', attachmentId)
    .eq('trip_id', tripId)
    .single()

  if (!attachment || !attachment.file_url) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: signed, error } = await supabase.storage
    .from('trip-attachments')
    .createSignedUrl(attachment.file_url, 3600)

  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: 'Could not generate download URL' }, { status: 500 })
  }

  return NextResponse.redirect(signed.signedUrl, 302)
}
