import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const supabase = createServiceClient()

  // Determine role for filtering — guest if unauthenticated
  let role = 'guest'
  try {
    const { userId } = await auth()
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('clerk_id', userId).single()
      if (profile?.role) role = profile.role
    }
  } catch { /* unauthenticated — treat as guest */ }

  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .contains('visibility_roles', [role])
    .order('start_date')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('clerk_id', userId).single()

  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { data, error } = await supabase
    .from('trips')
    .insert({
      title:              body.title,
      destination:        body.destination,
      description:        body.description ?? '',
      image_url:          body.image_url ?? null,
      start_date:         body.start_date,
      end_date:           body.end_date,
      currency:           'EUR',
      total_cost:         body.total_cost ?? 0,
      milestones:         body.milestones ?? [],
      visibility_roles:   body.visibility_roles ?? ['guest', 'member', 'core', 'admin'],
      location:           body.location ?? null,
      accommodation_type: body.accommodation_type ?? null,
      inclusions:         body.inclusions ?? [],
      trip_type:          body.trip_type ?? null,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}