import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerContext, getCallerProfile } from '@/lib/supabase/guards'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const profile = await getCallerProfile(userId, supabase)
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('*')
    .eq('id', id)
    .single()
  if (tripError) return Response.json({ error: tripError.message }, { status: 500 })

  const { data: registration } = await supabase
    .from('trip_registrations')
    .select('*')
    .eq('trip_id', id)
    .eq('profile_id', profile.id)
    .maybeSingle()

  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .eq('trip_id', id)
    .eq('profile_id', profile.id)
    .order('transaction_date', { ascending: true })

  return Response.json({ ...trip, registration: registration ?? null, payments: payments ?? [] })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const ctx = await getCallerContext(userId, supabase, 'admin')
  if (ctx.guard) return ctx.guard

  const body = await req.json()
  const { data, error } = await supabase
    .from('trips').update(body).eq('id', id).select().single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const ctx = await getCallerContext(userId, supabase, 'admin')
  if (ctx.guard) return ctx.guard

  const { error } = await supabase.from('trips').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ deleted: true })
}
