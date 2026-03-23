import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles').select('id').eq('clerk_id', userId).single()
  if (!profile?.id) return Response.json({ error: 'Profile not found' }, { status: 404 })

  // Registrations with trip details — include cancelled_at so the UI can detect cancellation
  const { data: registrations, error: regError } = await supabase
    .from('trip_registrations')
    .select('id, trip_id, status, created_at, cancelled_at, trips(id, title, destination, start_date, end_date, total_cost, currency)')
    .eq('profile_id', profile.id)
    .order('created_at', { ascending: false })

  if (regError) return Response.json({ error: regError.message }, { status: 500 })

  // All payments for this profile (trips + items)
  const { data: payments, error: payError } = await supabase
    .from('payments')
    .select('id, trip_id, payable_item_id, amount, currency, transaction_date, admin_status, member_status, payment_method, proof_url, note, logged_by_admin, created_at, trips(title), payable_items(title, item_type)')
    .eq('profile_id', profile.id)
    .order('transaction_date', { ascending: false })

  if (payError) return Response.json({ error: payError.message }, { status: 500 })

  // Group payments by trip_id for trip registrations view
  const paymentsByTrip: Record<string, typeof payments> = {}
  for (const p of (payments ?? [])) {
    if (!p.trip_id) continue
    if (!paymentsByTrip[p.trip_id]) paymentsByTrip[p.trip_id] = []
    paymentsByTrip[p.trip_id]!.push(p)
  }

  const result = (registrations ?? []).map(reg => ({
    registration_id: reg.id,
    registration_status: reg.status,
    registered_at: reg.created_at,
    cancelled_at: reg.cancelled_at ?? null,
    trip: reg.trips,
    payments: paymentsByTrip[reg.trip_id] ?? [],
  }))

  return Response.json(result)
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
  const { trip_id, payable_item_id, amount, currency, transaction_date, note, payment_method, proof_url } = body

  if (!amount || !transaction_date) {
    return Response.json({ error: 'amount and transaction_date are required' }, { status: 400 })
  }
  if ((!trip_id && !payable_item_id) || (trip_id && payable_item_id)) {
    return Response.json({ error: 'Exactly one of trip_id or payable_item_id is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('payments')
    .insert({
      profile_id:       profile.id,
      trip_id:          trip_id ?? null,
      payable_item_id:  payable_item_id ?? null,
      amount,
      currency:         currency ?? 'EUR',
      transaction_date,
      note:             note ?? null,
      payment_method:   payment_method ?? null,
      proof_url:        proof_url ?? null,
      member_status:    'approved',
      admin_status:     'pending',
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
