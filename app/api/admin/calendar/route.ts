import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin, getCallerContext } from '@/lib/supabase/guards'

export async function GET(req: Request): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const guard = await requireAdmin(userId, supabase)
  if (guard) return guard

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')
  const category = searchParams.get('category') // 'N21' | 'Personal' | null (= All)
  const timeScope = searchParams.get('timeScope') ?? 'upcoming' // 'upcoming' | 'past' | 'all'
  const month = searchParams.get('month') // 'YYYY-MM'

  let query = supabase
    .from('calendar_events')
    .select('*')
    .order('start_time', { ascending: true })

  if (search) query = query.ilike('title', `%${search}%`)
  if (category) query = query.eq('category', category)

  const now = new Date().toISOString()
  if (timeScope === 'upcoming') query = query.gte('start_time', now)
  else if (timeScope === 'past') query = query.lt('start_time', now)

  if (month) {
    const start = new Date(`${month}-01`).toISOString()
    const end = new Date(
      new Date(`${month}-01`).getFullYear(),
      new Date(`${month}-01`).getMonth() + 1,
      1
    ).toISOString()
    query = query.gte('start_time', start).lt('start_time', end)
  }

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const ctx = await getCallerContext(userId, supabase, 'admin')
  if (ctx.guard) return ctx.guard
  const caller = ctx.profile

  const body = await req.json()
  // Auto-compute week_number from start_time if not provided
  if (!body.week_number && body.start_time) {
    const d = new Date(body.start_time)
    const startOfYear = new Date(d.getFullYear(), 0, 1)
    body.week_number = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
  }
  body.created_by = caller.id

  const { data, error } = await supabase.from('calendar_events').insert(body).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Seed role slots for the new event
  const roles: string[] = data.available_roles ?? []
  if (roles.length > 0) {
    const { error: upsertError } = await supabase.from('event_role_slots').upsert(
      roles.map(role_label => ({ event_id: data.id, role_label })),
      { onConflict: 'event_id,role_label', ignoreDuplicates: true }
    )
    if (upsertError) return Response.json({ error: upsertError.message }, { status: 500 })
  }

  return Response.json(data, { status: 201 })
}
