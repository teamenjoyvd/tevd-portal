import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles').select('id').eq('clerk_id', userId).single()
  if (!profile?.id) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const { id: tripId } = await params

  // Find the registration — must belong to this profile
  const { data: registration } = await supabase
    .from('trip_registrations')
    .select('id, cancelled_at')
    .eq('trip_id', tripId)
    .eq('profile_id', profile.id)
    .single()

  if (!registration) return Response.json({ error: 'Registration not found' }, { status: 404 })
  if (registration.cancelled_at) return Response.json({ error: 'Already cancelled' }, { status: 409 })

  const { data, error } = await supabase
    .from('trip_registrations')
    .update({
      cancelled_at: new Date().toISOString(),
      cancelled_by: profile.id,
    })
    .eq('id', registration.id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
