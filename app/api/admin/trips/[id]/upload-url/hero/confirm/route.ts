import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

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
    .select('role')
    .eq('clerk_id', userId)
    .single()

  if (profile?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as { path?: string }
  const { path } = body

  if (!path) {
    return Response.json({ error: 'Missing path' }, { status: 400 })
  }

  // Cross-resource integrity: reject paths not scoped to this trip
  if (!path.startsWith(`${tripId}/`)) {
    return Response.json({ error: 'Path does not belong to this trip' }, { status: 403 })
  }

  // Purge previous hero images for this trip before confirming new one
  const folder = tripId
  const pathWithoutFolder = path.slice(folder.length + 1)
  const { data: existing } = await supabase.storage
    .from('trip-hero-images')
    .list(folder)
  if (existing && existing.length > 0) {
    const toRemove = existing
      .filter(o => o.name !== pathWithoutFolder)
      .map(o => `${folder}/${o.name}`)
    if (toRemove.length > 0) {
      await supabase.storage.from('trip-hero-images').remove(toRemove)
    }
  }

  const { data: { publicUrl } } = supabase.storage
    .from('trip-hero-images')
    .getPublicUrl(path)

  const { error: updateError } = await supabase
    .from('trips')
    .update({ image_url: publicUrl })
    .eq('id', tripId)

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 })
  }

  return Response.json({ url: publicUrl })
}
