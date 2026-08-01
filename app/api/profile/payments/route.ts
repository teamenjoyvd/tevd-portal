import { withProfile } from '@/lib/supabase/with-profile'
import { assertOwnProofPath, redactForeignProofUrls } from '@/lib/payments/proof'

export async function GET(): Promise<Response> {
  const ctx = await withProfile()
  if (ctx.response) return ctx.response
  const { supabase, profile } = ctx
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  // Registrations with trip details — include cancelled_at so the UI can detect cancellation —
  // and all payments for this profile (trips + items), fetched in parallel (independent queries).
  const [
    { data: registrations, error: regError },
    { data: payments, error: payError },
  ] = await Promise.all([
    supabase
      .from('trip_registrations')
      .select('id, trip_id, status, created_at, cancelled_at, trips(id, title, destination, start_date, end_date, total_cost, currency)')
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('payments')
      // profile_id + paid_by_profile_id are selected only so the proof redaction
      // below can tell who paid; this route still lists one profile's own rows.
      .select('id, trip_id, payable_item_id, amount, currency, transaction_date, admin_status, member_status, payment_method, proof_url, note, logged_by_admin, created_at, profile_id, paid_by_profile_id, trips(title), payable_items(title, item_type)')
      .eq('profile_id', profile.id)
      .order('transaction_date', { ascending: false }),
  ])

  if (regError) return Response.json({ error: regError.message }, { status: 500 })
  if (payError) return Response.json({ error: payError.message }, { status: 500 })

  // Rows on this profile's ledger now include ones somebody else paid for
  // (2607-DEV-676), whose proof object belongs to that payer. Withhold the path
  // from everyone but the payer — see lib/payments/proof.ts.
  const visiblePayments = redactForeignProofUrls(payments ?? [], profile.id)

  // Group payments by trip_id for trip registrations view
  const paymentsByTrip: Record<string, typeof visiblePayments> = {}
  for (const p of visiblePayments) {
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
  const ctx = await withProfile<{ id: string; role: string; first_name: string | null }>('id, role, first_name')
  if (ctx.response) return ctx.response
  const { supabase, profile } = ctx
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

  // Same storage-prefix guard as POST /api/payments: an unvalidated proof_url
  // here would let a caller attach someone else's object to their own row, which
  // /api/profile/payments/[id]/proof would then sign for them.
  const proofCheck = assertOwnProofPath(proof_url, profile.id)
  if (!proofCheck.ok) return Response.json({ error: proofCheck.error }, { status: 400 })

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
      proof_url:        proofCheck.value,
      member_status:    'approved',
      admin_status:     'pending',
    })
    .select('*, trips(title), payable_items(title)')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Trigger admin alert asynchronously
  const tripsData = data.trips as { title: string } | null
  const itemsData = data.payable_items as { title: string } | null
  const itemTitle = tripsData?.title || itemsData?.title || 'Unknown Item'

  import('@/lib/email/send').then(({ sendNotificationEmail, getEmailConfig }) => {
    getEmailConfig().then(config => {
      if (!config.alert_recipient) return

      import('@/lib/email/templates/render').then(({ renderEmailTemplate }) => {
        import('@/lib/email/templates/PaymentSubmittedEmail').then(({ PaymentSubmittedEmail }) => {
          renderEmailTemplate(
            PaymentSubmittedEmail({
              memberName: profile.first_name || 'Member',
              amount: data.amount,
              currency: data.currency,
              transactionDate: data.transaction_date,
              itemTitle,
              paymentMethod: data.payment_method,
            })
          ).then(html => {
            sendNotificationEmail({
              to: config.alert_recipient,
              subject: `New Payment Logged by ${profile.first_name || 'Member'}`,
              html,
              template: 'payment_status',
              meta: { payment_id: data.id, profile_id: profile.id },
            }).catch(console.error)
          }).catch(console.error)
        }).catch(console.error)
      }).catch(console.error)
    }).catch(console.error)
  }).catch(console.error)

  return Response.json(data, { status: 201 })
}
