import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdminOrCore } from '@/lib/supabase/guards'

export async function GET(req: Request): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const guard = await requireAdminOrCore(userId, supabase)
  if (guard) return guard

  const { searchParams } = new URL(req.url)
  const statusFilter = searchParams.get('admin_status')

  // profiles!profile_id disambiguates the FK — payments has two FKs to profiles
  // (profile_id and logged_by_admin), which causes PostgREST to 500 without a hint.
  let query = supabase
    .from('payments')
    .select('id, amount, currency, transaction_date, admin_status, member_status, admin_reject_reason, member_reject_reason, payment_method, proof_url, note, admin_note, logged_by_admin, created_at, profiles!profile_id(first_name, last_name, abo_number), trips(title, destination), payable_items(title, item_type, currency)')
    .order('created_at', { ascending: false })

  if (statusFilter) query = query.eq('admin_status', statusFilter)

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  // Need caller.id for logged_by_admin — fetch id + role together
  const { data: caller } = await supabase
    .from('profiles').select('id, role').eq('clerk_id', userId).single()
  if (!caller || (caller.role !== 'admin' && caller.role !== 'core')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { trip_id, payable_item_id, profile_id, amount, currency, transaction_date, payment_method, note, admin_status } = body

  if (!profile_id || !amount || !transaction_date) {
    return Response.json({ error: 'profile_id, amount, and transaction_date are required' }, { status: 400 })
  }
  if ((!trip_id && !payable_item_id) || (trip_id && payable_item_id)) {
    return Response.json({ error: 'Exactly one of trip_id or payable_item_id is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('payments')
    .insert({
      profile_id,
      trip_id:          trip_id ?? null,
      payable_item_id:  payable_item_id ?? null,
      amount,
      currency:         currency ?? 'EUR',
      transaction_date,
      payment_method:   payment_method ?? null,
      note:             note ?? null,
      logged_by_admin:  caller.id,
      admin_status:     admin_status ?? 'approved',
      member_status:    'pending',
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
