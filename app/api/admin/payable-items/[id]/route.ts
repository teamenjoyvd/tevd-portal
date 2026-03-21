import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('clerk_id', userId).single()
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const { title, description, amount, currency, item_type, linked_trip_id, is_active } = body

  if (item_type !== undefined && !['trip', 'book', 'ticket', 'other'].includes(item_type)) {
    return Response.json({ error: 'item_type must be trip, book, ticket, or other' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (title !== undefined)         update.title = title
  if (description !== undefined)   update.description = description
  if (amount !== undefined)        update.amount = amount
  if (currency !== undefined)      update.currency = currency
  if (item_type !== undefined)     update.item_type = item_type
  if (linked_trip_id !== undefined) update.linked_trip_id = linked_trip_id
  if (is_active !== undefined)     update.is_active = is_active

  if (Object.keys(update).length === 0) {
    return Response.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('payable_items')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('clerk_id', userId).single()
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const { data, error } = await supabase
    .from('payable_items')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
