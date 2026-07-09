import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyAndApproveAbo } from '@/lib/abo/verifyAbo'

// ---------------------------------------------------------------------------
// POST — submit ABO verification
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, abo_number, primary_profile_id, first_name, contact_email')
    .eq('clerk_id', userId)
    .single()

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
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_id', userId)
    .single()
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
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_id', userId)
    .single()
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('abo_verification_requests')
    .select('*')
    .eq('profile_id', profile.id)
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
