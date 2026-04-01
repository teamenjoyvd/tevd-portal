import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_id', userId)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

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

  // Derive storage path from the public URL
  const url = new URL(attachment.file_url)
  // path is: /storage/v1/object/public/trip-attachments/{trip_id}/{filename}
  const storagePath = url.pathname.split('/trip-attachments/')[1]

  if (storagePath) {
    await supabase.storage.from('trip-attachments').remove([storagePath])
  }

  const { error: deleteError } = await supabase
    .from('trip_attachments')
    .delete()
    .eq('id', attachmentId)

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
