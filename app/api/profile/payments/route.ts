import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_id', userId)
    .single()

  if (!profile?.id) return Response.json({ error: 'Profile not found' }, { status: 404 })

  // Fetch registrations joined with trip details
  const { data: registrations, error: regError } = await supabase
    .from('trip_registrations')
    .select('id, status, trip_id, trips(id, title, destination, start_date, end_date, total_cost, currency)')
    .eq('profile_id', profile.id)
    .order('created_at', { ascending: false })

  if (regError) return Response.json({ error: regError.message }, { status: 500 })

  // Fetch all payments for this profile
  const { data: payments, error: payError } = await supabase
    .from('trip_payments')
    .select('id, trip_id, amount, transaction_date, status, payment_method, proof_url, note, submitted_by_member, created_at')
    .eq('profile_id', profile.id)
    .order('transaction_date', { ascending: false })

  if (payError) return Response.json({ error: payError.message }, { status: 500 })

  // Group payments by trip_id for easy client-side consumption
  const paymentsByTrip: Record<string, typeof payments> = {}
  for (const p of (payments ?? [])) {
    if (!paymentsByTrip[p.trip_id]) paymentsByTrip[p.trip_id] = []
    paymentsByTrip[p.trip_id]!.push(p)
  }

  const result = (registrations ?? []).map(r => ({
    registration_id: r.id,
    registration_status: r.status,
    trip: r.trips,
    payments: paymentsByTrip[r.trip_id] ?? [],
  }))

  return Response.json(result)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_id', userId)
    .single()

  if (!profile?.id) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const body = await req.json()
  const { trip_id, amount, transaction_date, note, payment_method, proof_url } = body

  if (!trip_id || !amount || !transaction_date) {
    return Response.json({ error: 'trip_id, amount, and transaction_date are required' }, { status: 400 })
  }

  // Validate member has a registration for this trip
  const { data: registration } = await supabase
    .from('trip_registrations')
    .select('id')
    .eq('profile_id', profile.id)
    .eq('trip_id', trip_id)
    .single()

  if (!registration) {
    return Response.json({ error: 'You do not have a registration for this trip' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('trip_payments')
    .insert({
      profile_id: profile.id,
      trip_id,
      amount,
      transaction_date,
      note: note ?? null,
      payment_method: payment_method ?? null,
      proof_url: proof_url ?? null,
      submitted_by_member: true,
      status: 'pending',
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
