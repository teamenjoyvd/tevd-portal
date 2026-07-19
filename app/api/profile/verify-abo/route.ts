import { withProfile } from '@/lib/supabase/with-profile'
import { verifyAndApproveAbo } from '@/lib/abo/verifyAbo'

type VerifyAboProfile = {
  id: string
  role: string
  abo_number: string | null
  primary_profile_id: string | null
  first_name: string | null
  contact_email: string | null
}

// ---------------------------------------------------------------------------
// POST — submit ABO verification
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const ctx = await withProfile<VerifyAboProfile>(
    'id, role, abo_number, primary_profile_id, first_name, contact_email'
  )
  if (ctx.response) return ctx.response
  const { userId, supabase, profile } = ctx

  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  // Guard: secondary accounts cannot submit ABO verification
  if (profile.primary_profile_id) {
    return Response.json(
      {
        error: 'Secondary accounts cannot submit ABO verification',
        error_code: 'secondary_cannot_verify',
      },
      { status: 400 }
    )
  }

  if (profile.abo_number) return Response.json({ error: 'ABO already verified' }, { status: 409 })
  if (profile.role !== 'guest') return Response.json({ error: 'Already verified' }, { status: 409 })

  const body = await req.json()

  // Manual path removed — 400 if submitted
  if (body.request_type === 'manual') {
    return Response.json(
      { error: 'Manual verification requests are no longer accepted via this endpoint.' },
      { status: 400 }
    )
  }

  const { claimed_abo, claimed_upline_abo } = body

  if (!claimed_abo || !claimed_upline_abo) {
    return Response.json(
      { error: 'claimed_abo and claimed_upline_abo are required' },
      { status: 400 }
    )
  }

  const outcome = await verifyAndApproveAbo(supabase, userId, profile, claimed_abo, claimed_upline_abo)
  return Response.json(outcome.body, { status: outcome.status })
}

// ---------------------------------------------------------------------------
// DELETE — cancel a pending request
// ---------------------------------------------------------------------------

export async function DELETE() {
  const ctx = await withProfile<{ id: string }>('id')
  if (ctx.response) return ctx.response
  const { supabase, profile } = ctx
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const { error } = await supabase
    .from('abo_verification_requests')
    .delete()
    .eq('profile_id', profile.id)
    .eq('status', 'pending')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ cancelled: true })
}

// ---------------------------------------------------------------------------
// GET — fetch current request status
// ---------------------------------------------------------------------------

export async function GET() {
  const ctx = await withProfile<{ id: string }>('id')
  if (ctx.response) return ctx.response
  const { supabase, profile } = ctx
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('abo_verification_requests')
    .select('*')
    .eq('profile_id', profile.id)
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
