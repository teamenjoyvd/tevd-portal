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

  if (!path || typeof path !== 'string') {
    return Response.json({ error: 'path is required' }, { status: 400 })
  }

  // Traversal guard
  if (path.includes('..')) {
    return Response.json({ error: 'Invalid path' }, { status: 400 })
  }

  // Ownership: path must be scoped to this trip (same as confirm route)
  if (!path.startsWith(`${tripId}/`)) {
    return Response.json({ error: 'Path does not belong to this trip' }, { status: 403 })
  }

  // Inline images live in JSONContent only — no trip_attachments row.
  const { data: { publicUrl } } = supabase.storage
    .from('trip-attachments')
    .getPublicUrl(path)

  return Response.json({ url: publicUrl })
}
