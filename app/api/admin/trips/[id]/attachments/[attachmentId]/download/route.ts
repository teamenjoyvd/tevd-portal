import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerContext } from '@/lib/supabase/guards'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const ctx = await getCallerContext(userId, supabase, 'admin')
  if (ctx.guard) return ctx.guard

  const { id: tripId, attachmentId } = await params

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
    console.error('[ADMIN_DOWNLOAD_ERROR]', error)
    return NextResponse.json({ error: 'Could not generate download URL' }, { status: 500 })
  }

  return NextResponse.redirect(signed.signedUrl, 302)
}
