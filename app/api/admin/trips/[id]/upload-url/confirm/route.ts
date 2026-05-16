import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

const ALLOWED_MIME: Record<string, 'pdf' | 'image'> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
  'image/heic': 'image',
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('clerk_id', userId)
    .single()

  if (!profile || profile.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as { path?: string; filename?: string; fileType?: string }
  const { path, filename, fileType } = body

  if (!path || !filename || !fileType) {
    return Response.json({ error: 'Missing path, filename, or fileType' }, { status: 400 })
  }

  // Cross-resource integrity: reject paths not scoped to this trip
  if (!path.startsWith(`${tripId}/`)) {
    return Response.json({ error: 'Path does not belong to this trip' }, { status: 403 })
  }

  const fileTypeMapped = ALLOWED_MIME[fileType]
  if (!fileTypeMapped) {
    return Response.json({ error: 'Unsupported file type' }, { status: 415 })
  }

  const { data: { publicUrl } } = supabase.storage
    .from('trip-attachments')
    .getPublicUrl(path)

  // Derive sort_order as max existing + 1
  const { data: maxRow } = await supabase
    .from('trip_attachments')
    .select('sort_order')
    .eq('trip_id', tripId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const sort_order = (maxRow?.sort_order ?? -1) + 1

  const { data: attachment, error: insertError } = await supabase
    .from('trip_attachments')
    .insert({
      trip_id: tripId,
      file_url: publicUrl,
      file_name: filename,
      file_type: fileTypeMapped,
      sort_order,
      created_by: profile.id,
    })
    .select('id, file_name, file_url, file_type, sort_order, created_at')
    .single()

  if (insertError) {
    // Best-effort cleanup of orphaned storage object
    await supabase.storage.from('trip-attachments').remove([path])
    return Response.json({ error: insertError.message }, { status: 500 })
  }

  // useSignedUpload expects { url } in the confirm response.
  // Spread attachment fields alongside so TripFilesSection still gets the full row.
  return Response.json({ url: publicUrl, ...attachment }, { status: 201 })
}
