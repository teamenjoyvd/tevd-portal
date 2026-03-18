import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles').select('id').eq('clerk_id', userId).single()
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const update: Record<string, unknown> = {}

  if ('is_read' in body) update.is_read = body.is_read
  if ('deleted_at' in body) update.deleted_at = body.deleted_at

  if (Object.keys(update).length === 0) {
    return Response.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('notifications')
    .update(update)
    .eq('id', id)
    .eq('profile_id', profile.id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
