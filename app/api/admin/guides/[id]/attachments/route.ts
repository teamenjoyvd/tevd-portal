import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const MAX_BYTES = 20 * 1024 * 1024 // 20 MB
const ALLOWED_MIME: Record<string, 'pdf' | 'image'> = {
  'application/pdf': 'pdf',
  'image/jpeg':      'image',
  'image/png':       'image',
  'image/webp':      'image',
  'image/gif':       'image',
}

async function requireAdmin(userId: string | null) {
  if (!userId) return null
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('clerk_id', userId)
    .single()
  if (!data || data.role !== 'admin') return null
  return data
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { userId } = await auth()
  const profile = await requireAdmin(userId)
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: guideId } = await params
  const supabase = createServiceClient()

  const formData = await req.formData()
  const file = formData.get('file')
  const label = formData.get('label')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 20 MB limit' }, { status: 413 })
  }

  const fileType = ALLOWED_MIME[file.type] ?? 'other'
  if (!ALLOWED_MIME[file.type] && file.type !== '') {
    // allow through as 'other' only for known binary-safe types; reject otherwise
    // keep simple: anything not in ALLOWED_MIME is rejected
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 })
  }

  const ext = file.name.split('.').pop() ?? 'bin'
  const storagePath = `${guideId}/${crypto.randomUUID()}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from('guide-attachments')
    .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage
    .from('guide-attachments')
    .getPublicUrl(storagePath)

  const { data: maxRow } = await supabase
    .from('guide_attachments')
    .select('sort_order')
    .eq('guide_id', guideId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const sort_order = (maxRow?.sort_order ?? -1) + 1

  const { data: attachment, error: insertError } = await supabase
    .from('guide_attachments')
    .insert({
      guide_id:   guideId,
      file_url:   publicUrl,
      file_name:  file.name,
      label:      typeof label === 'string' && label.trim() ? label.trim() : null,
      file_type:  fileType,
      sort_order,
    })
    .select()
    .single()

  if (insertError) {
    await supabase.storage.from('guide-attachments').remove([storagePath])
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
  const { id: guideId } = await params

  const { data, error } = await supabase
    .from('guide_attachments')
    .select('id, file_url, file_name, label, file_type, sort_order, created_at')
    .eq('guide_id', guideId)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { userId } = await auth()
  const profile = await requireAdmin(userId)
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: guideId } = await params
  const supabase = createServiceClient()

  const body = await req.json() as { items: { id: string; sort_order: number }[] }
  if (!Array.isArray(body?.items)) {
    return NextResponse.json({ error: 'items array required' }, { status: 400 })
  }

  const errors: string[] = []
  for (const item of body.items) {
    const { error } = await supabase
      .from('guide_attachments')
      .update({ sort_order: item.sort_order })
      .eq('id', item.id)
      .eq('guide_id', guideId)
    if (error) errors.push(error.message)
  }

  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
