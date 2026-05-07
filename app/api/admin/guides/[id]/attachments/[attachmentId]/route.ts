import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

async function requireAdmin(userId: string | null) {
  if (!userId) return null
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_id', userId)
    .single()
  return data?.role === 'admin' ? data : null
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
): Promise<NextResponse> {
  const { userId } = await auth()
  const profile = await requireAdmin(userId)
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: guideId, attachmentId } = await params
  const supabase = createServiceClient()

  const { data: attachment, error: fetchError } = await supabase
    .from('guide_attachments')
    .select('id, file_url, guide_id')
    .eq('id', attachmentId)
    .eq('guide_id', guideId)
    .single()

  if (fetchError || !attachment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Delete DB row first — orphaned storage objects are recoverable
  const { error: deleteError } = await supabase
    .from('guide_attachments')
    .delete()
    .eq('id', attachmentId)

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  // Best-effort storage cleanup
  const url = new URL(attachment.file_url)
  const storagePath = url.pathname.split('/guide-attachments/')[1]
  if (storagePath) {
    await supabase.storage.from('guide-attachments').remove([storagePath])
  }

  return new NextResponse(null, { status: 204 })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
): Promise<NextResponse> {
  const { userId } = await auth()
  const profile = await requireAdmin(userId)
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: guideId, attachmentId } = await params
  const supabase = createServiceClient()

  const body = await req.json() as { label: string }
  if (typeof body?.label !== 'string') {
    return NextResponse.json({ error: 'label string required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('guide_attachments')
    .update({ label: body.label.trim() || null })
    .eq('id', attachmentId)
    .eq('guide_id', guideId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
