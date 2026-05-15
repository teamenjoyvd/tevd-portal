import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

// POST handler removed — hero upload flow now uses signed URL via
// GET  /api/admin/trips/[id]/upload-url/hero
// POST /api/admin/trips/[id]/upload-url/hero/confirm

// Helper: remove all objects under trips/{id}/ folder in storage
export async function purgeStorageFolder(
  supabase: ReturnType<typeof createServiceClient>,
  folder: string
) {
  const { data: objects } = await supabase.storage
    .from('trip-hero-images')
    .list(folder)
  if (objects && objects.length > 0) {
    const paths = objects.map(o => `${folder}/${o.name}`)
    await supabase.storage.from('trip-hero-images').remove(paths)
  }
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
