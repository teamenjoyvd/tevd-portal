import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles').select('id').eq('clerk_id', userId).single()
  if (!profile?.id) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('payments')
    .select('id, amount, currency, transaction_date, admin_status, member_status, payment_method, proof_url, note, admin_note, created_at, payable_items(id, title, item_type, currency), trips(id, title)')
    .eq('profile_id', profile.id)
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
  if (!profile?.id) return Response.json({ error: 'Profile not found' }, { status: 404 })
  if (profile.role === 'guest') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { trip_id, payable_item_id, amount, currency, transaction_date, payment_method, proof_url, note } = body

  if (!amount || !transaction_date) {
    return Response.json({ error: 'amount and transaction_date are required' }, { status: 400 })
  }
  if ((!trip_id && !payable_item_id) || (trip_id && payable_item_id)) {
    return Response.json({ error: 'Exactly one of trip_id or payable_item_id is required' }, { status: 400 })
  }

  if (payable_item_id) {
    const { data: item } = await supabase
      .from('payable_items').select('id').eq('id', payable_item_id).eq('is_active', true).single()
    if (!item) return Response.json({ error: 'Payable item not found or inactive' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('payments')
    .insert({
      profile_id:      profile.id,
      trip_id:         trip_id ?? null,
      payable_item_id: payable_item_id ?? null,
      amount,
      currency:        currency ?? 'EUR',
      transaction_date,
      payment_method:  payment_method ?? null,
      proof_url:       proof_url ?? null,
      note:            note ?? null,
      member_status:   'approved',
      admin_status:    'pending',
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
