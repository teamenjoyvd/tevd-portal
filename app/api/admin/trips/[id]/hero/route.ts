import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

// Helper: remove all objects under trips/{id}/ folder in storage
async function purgeStorageFolder(supabase: ReturnType<typeof createServiceClient>, folder: string) {
  const { data: objects } = await supabase.storage
    .from('trip-hero-images')
    .list(folder)
  if (objects && objects.length > 0) {
    const paths = objects.map(o => `${folder}/${o.name}`)
    await supabase.storage.from('trip-hero-images').remove(paths)
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_id', userId)
    .single()

  if (profile?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return Response.json({ error: 'No file provided' }, { status: 400 })

  // Remove any existing hero images for this trip before uploading the new one
  await purgeStorageFolder(supabase, id)

  const ext = file.name.split('.').pop() ?? 'jpg'
  const filename = `${id}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('trip-hero-images')
    .upload(filename, file, { upsert: true, contentType: file.type })

  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: urlData } = supabase.storage
    .from('trip-hero-images')
    .getPublicUrl(filename)

  const { data: trip, error: updateError } = await supabase
    .from('trips')
    .update({ image_url: urlData.publicUrl })
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 })
  }

  return Response.json(trip)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_id', userId)
    .single()

  if (profile?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Remove all storage objects under this trip's folder — deterministic, no URL parsing
  await purgeStorageFolder(supabase, id)

  const { data: updated, error } = await supabase
    .from('trips')
    .update({ image_url: null })
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(updated)
}
