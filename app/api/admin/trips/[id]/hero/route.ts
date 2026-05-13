import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

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

  // Fetch current image_url to derive storage path
  const { data: trip } = await supabase
    .from('trips')
    .select('image_url')
    .eq('id', id)
    .single()

  if (trip?.image_url) {
    // Extract path after bucket name in the public URL
    const url = new URL(trip.image_url)
    const pathParts = url.pathname.split('/trip-hero-images/')
    const storagePath = pathParts[1]
    if (storagePath) {
      await supabase.storage.from('trip-hero-images').remove([storagePath])
    }
  }

  const { data: updated, error } = await supabase
    .from('trips')
    .update({ image_url: null })
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(updated)
}
