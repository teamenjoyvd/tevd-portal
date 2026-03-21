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
    .select('id, amount, transaction_date, status, payment_method, proof_url, note, admin_note, created_at, payable_items(id, title, item_type, currency)')
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
    .from('profiles').select('id').eq('clerk_id', userId).single()
  if (!profile?.id) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const body = await req.json()
  const { payable_item_id, amount, transaction_date, payment_method, proof_url, note } = body

  if (!payable_item_id || amount == null || !transaction_date) {
    return Response.json({ error: 'payable_item_id, amount, and transaction_date are required' }, { status: 400 })
  }

  // Verify payable item is active
  const { data: item } = await supabase
    .from('payable_items')
    .select('id')
    .eq('id', payable_item_id)
    .eq('is_active', true)
    .single()

  if (!item) return Response.json({ error: 'Payable item not found or inactive' }, { status: 404 })

  const { data, error } = await supabase
    .from('payments')
    .insert({
      profile_id:       profile.id,
      payable_item_id,
      amount,
      transaction_date,
      payment_method:   payment_method ?? null,
      proof_url:        proof_url ?? null,
      note:             note ?? null,
      submitted_by_member: true,
      status:           'pending',
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
