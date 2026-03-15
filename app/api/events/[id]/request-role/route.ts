import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: event_id } = await params
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles').select('id, role').eq('clerk_id', userId).single()
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  // Guests cannot request roles
  if (profile.role === 'guest') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { role_label, note } = await req.json()
  if (!role_label) return Response.json({ error: 'role_label required' }, { status: 400 })

  const { data, error } = await supabase
    .from('event_role_requests')
    .insert({ event_id, profile_id: profile.id, role_label, note: note ?? null })
    .select()
    .single()

  if (error) {
    // Unique constraint — already requested
    if (error.code === '23505') {
      return Response.json({ error: 'You already have a request for this event' }, { status: 409 })
    }
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data, { status: 201 })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: event_id } = await params
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles').select('id').eq('clerk_id', userId).single()
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const { error } = await supabase
    .from('event_role_requests')
    .delete()
    .eq('event_id', event_id)
    .eq('profile_id', profile.id)
    .eq('status', 'pending') // Can only cancel pending requests

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ cancelled: true })
}