import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('clerk_id', userId).single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'core')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('payable_items')
    .select('id, title, description, amount, currency, item_type, linked_trip_id, is_active, created_at, trips(title)')
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles').select('id, role').eq('clerk_id', userId).single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'core')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { title, description, amount, currency, item_type, linked_trip_id } = body

  if (!title || amount == null || !item_type) {
    return Response.json({ error: 'title, amount, and item_type are required' }, { status: 400 })
  }

  if (!['merchandise', 'ticket', 'food', 'book', 'other'].includes(item_type)) {
    return Response.json({ error: 'item_type must be merchandise, ticket, food, book, or other' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('payable_items')
    .insert({
      title,
      description: description ?? null,
      amount,
      currency: currency ?? 'EUR',
      item_type,
      linked_trip_id: linked_trip_id || null,
      created_by: profile.id,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
