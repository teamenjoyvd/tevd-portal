import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerContext } from '@/lib/supabase/guards'
import { getRoleForAccess } from '@/lib/server/guides'
import { ALL_ROLES } from '@/lib/roles'

export async function GET() {
  const supabase = createServiceClient()
  const role = await getRoleForAccess()

  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .contains('access_roles', [role])
    .order('start_date')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const ctx = await getCallerContext(userId, supabase, 'admin')
  if (ctx.guard) return ctx.guard

  const body = await req.json()
  const { data, error } = await supabase
    .from('trips')
    .insert({
      title:              body.title,
      destination:        body.destination,
      // description is jsonb (JSONContent | null) — null is the correct empty default;
      // || null coerces both undefined and empty string '' to null, defending
      // against any client path that sends an empty string instead of null/undefined.
      description:        body.description || null,
      image_url:          body.image_url ?? null,
      start_date:         body.start_date,
      end_date:           body.end_date,
      currency:           'EUR',
      total_cost:         body.total_cost ?? 0,
      milestones:         body.milestones ?? [],
      access_roles:       Array.isArray(body.access_roles) ? body.access_roles : [...ALL_ROLES],
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
