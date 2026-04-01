import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/supabase/guards'

export async function GET(): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const guard = await requireAdmin(userId, supabase)
  if (guard) return guard

  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .order('start_time', { ascending: true })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const { data: caller } = await supabase.from('profiles').select('id, role').eq('clerk_id', userId).single()
  if (caller?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

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
  return Response.json(data, { status: 201 })
}
