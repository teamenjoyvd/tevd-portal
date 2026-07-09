import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerContext } from '@/lib/supabase/guards'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const ctx = await getCallerContext(userId, supabase, 'admin')
  if (ctx.guard) return ctx.guard

  const { id: tripId, attachmentId } = await params

  const { data: attachment, error: fetchError } = await supabase
    .from('trip_attachments')
    .select('id, file_url, trip_id')
    .eq('id', attachmentId)
    .eq('trip_id', tripId)
    .single()

  if (fetchError || !attachment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // file_url now stores the storage path directly — no URL parsing needed
  if (attachment.file_url) {
    await supabase.storage.from('trip-attachments').remove([attachment.file_url])
  }

  const { error: deleteError } = await supabase
    .from('trip_attachments')
    .delete()
    .eq('id', attachmentId)

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
