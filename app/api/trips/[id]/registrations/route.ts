import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerProfile } from '@/lib/supabase/guards'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: trip_id } = await params
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const profile = await getCallerProfile(userId, supabase)
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  // Admins get the full registration list for the trip.
  // All other authenticated users get only their own registration row.
  let query = supabase
    .from('trip_registrations')
    .select('*, profile:profiles!profile_id(id, first_name, last_name, abo_number)')
    .eq('trip_id', trip_id)
    .order('created_at')

  if (profile.role !== 'admin') {
    query = query.eq('profile_id', profile.id)
  }

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
