import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerProfile } from '@/lib/supabase/guards'
import { MAX_BENEFICIARIES, assertGroupAllowed } from '@/lib/payments/eligibility'

/** One beneficiary of an on-behalf payment, as the client sends it. */
type BeneficiaryInput = { profile_id: string; amount_cents: number }

export async function GET(): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const profile = await getCallerProfile(userId, supabase)
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  // Widened for 2607-DEV-676: rows on MY ledger plus rows I paid for on someone
  // else's. The only consumer (PaymentsSection) lists these rather than summing
  // them, so no total changes; the money totals still sum by profile_id alone.
  const { data, error } = await supabase
    .from('payments')
    .select('id, amount, currency, transaction_date, admin_status, member_status, payment_method, proof_url, note, admin_note, created_at, profile_id, paid_by_profile_id, payment_group_id, beneficiary:profiles!profile_id(id, first_name, last_name), payer:profiles!paid_by_profile_id(id, first_name, last_name), payable_items(id, title, item_type, currency), trips(id, title)')
    .or(`profile_id.eq.${profile.id},paid_by_profile_id.eq.${profile.id}`)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const profile = await getCallerProfile(userId, supabase)
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })
  if (profile.role === 'guest') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { trip_id, payable_item_id, amount, currency, transaction_date, payment_method, proof_url, note, beneficiaries, total_cents } = body

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

  // ── On-behalf submission (2607-DEV-676) ────────────────────────────────────
  // Strictly additive: with no `beneficiaries` key the request falls through to
  // the legacy single-row insert below, byte for byte as before.
  if (beneficiaries !== undefined) {
    if (!Array.isArray(beneficiaries) || beneficiaries.length === 0) {
      return Response.json({ error: 'beneficiaries must be a non-empty array' }, { status: 400 })
    }
    if (beneficiaries.length > MAX_BENEFICIARIES) {
      return Response.json(
        { error: `At most ${MAX_BENEFICIARIES} beneficiaries are allowed per payment` },
        { status: 400 },
      )
    }

    const rows: BeneficiaryInput[] = beneficiaries
    for (const row of rows) {
      if (typeof row?.profile_id !== 'string' || row.profile_id.length === 0) {
        return Response.json({ error: 'each beneficiary needs a profile_id' }, { status: 400 })
      }
      // Compared explicitly rather than truthiness-checked: 0 is a real number
      // and must be rejected as an amount, not silently read as "missing".
      if (!Number.isInteger(row.amount_cents) || row.amount_cents <= 0) {
        return Response.json(
          { error: 'each beneficiary amount_cents must be a positive integer' },
          { status: 400 },
        )
      }
    }

    // Money is compared in integer cents only — never in euro floats.
    const totalCents = Number.isInteger(total_cents) ? total_cents : Math.round(Number(amount) * 100)
    if (!Number.isInteger(totalCents) || totalCents <= 0) {
      return Response.json({ error: 'total must be a positive integer number of cents' }, { status: 400 })
    }
    const sumCents = rows.reduce((acc, row) => acc + row.amount_cents, 0)
    if (sumCents !== totalCents) {
      return Response.json(
        { error: `beneficiary amounts sum to ${sumCents} cents but the total is ${totalCents} cents` },
        { status: 400 },
      )
    }

    // Pre-flight so a hand-crafted request gets a clean 403 instead of a raw
    // Postgres error. NOT the boundary — submit_payment_group re-runs can_pay_for
    // inside the write transaction, where RLS being bypassed cannot matter.
    const check = await assertGroupAllowed(supabase, profile.id, rows.map((r) => r.profile_id))
    if (!check.ok) return Response.json({ error: check.error }, { status: check.status })

    // payment_group_id is generated inside the RPC — never accepted from the client.
    const { data: groupId, error: rpcError } = await supabase.rpc('submit_payment_group', {
      p_payer: profile.id,
      p_payload: {
        trip_id:          trip_id ?? null,
        payable_item_id:  payable_item_id ?? null,
        currency:         currency ?? 'EUR',
        transaction_date,
        payment_method:   payment_method ?? null,
        proof_url:        proof_url ?? null,
        note:             note ?? null,
        total_cents:      totalCents,
        beneficiaries:    rows,
      },
    })

    if (rpcError) {
      // P0001 is the RPC's own assertion vocabulary; every shape/sum case is
      // already screened above, so one reaching us is the eligibility re-check.
      const status = rpcError.code === 'P0001' ? 403 : 500
      return Response.json({ error: rpcError.message }, { status })
    }

    const { data: created, error: readError } = await supabase
      .from('payments')
      .select('id, amount, currency, transaction_date, admin_status, member_status, proof_url, note, profile_id, paid_by_profile_id, payment_group_id')
      .eq('payment_group_id', groupId)
      .order('created_at', { ascending: true })

    if (readError) return Response.json({ error: readError.message }, { status: 500 })
    return Response.json({ payment_group_id: groupId, payments: created ?? [] }, { status: 201 })
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
