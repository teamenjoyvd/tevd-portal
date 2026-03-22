import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: adminProfile } = await supabase
    .from('profiles').select('id, role').eq('clerk_id', userId).single()
  if (adminProfile?.role !== 'admin' && adminProfile?.role !== 'core') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: registrationId } = await params

  // Find the registration by its own id (admin/core can cancel any)
  const { data: registration } = await supabase
    .from('trip_registrations')
    .select('id, cancelled_at')
    .eq('id', registrationId)
    .single()

  if (!registration) return Response.json({ error: 'Registration not found' }, { status: 404 })
  if (registration.cancelled_at) return Response.json({ error: 'Already cancelled' }, { status: 409 })

  const { data, error } = await supabase
    .from('trip_registrations')
    .update({
      cancelled_at: new Date().toISOString(),
      cancelled_by: adminProfile.id,
    })
    .eq('id', registrationId)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
