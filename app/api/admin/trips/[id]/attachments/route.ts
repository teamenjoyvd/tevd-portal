import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_MIME: Record<string, 'pdf' | 'image'> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
  'image/heic': 'image',
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('clerk_id', userId)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: tripId } = await params

  const formData = await req.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 10 MB limit' }, { status: 413 })
  }

  const fileType = ALLOWED_MIME[file.type]
  if (!fileType) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 })
  }

  const ext = file.type === 'application/pdf' ? 'pdf' : file.name.split('.').pop() ?? 'bin'
  const storagePath = `${tripId}/${crypto.randomUUID()}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from('trip-attachments')
    .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage
    .from('trip-attachments')
    .getPublicUrl(storagePath)

  const { data: attachment, error: insertError } = await supabase
    .from('trip_attachments')
    .insert({
      trip_id: tripId,
      file_url: publicUrl,
      file_name: file.name,
      file_type: fileType,
      created_by: profile.id,
    })
    .select()
    .single()

  if (insertError) {
    // Best-effort cleanup of orphaned storage object
    await supabase.storage.from('trip-attachments').remove([storagePath])
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json(attachment, { status: 201 })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('clerk_id', userId)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: tripId } = await params

  const { data, error } = await supabase
    .from('trip_attachments')
    .select('id, file_url, file_name, file_type, sort_order, created_at')
    .eq('trip_id', tripId)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
