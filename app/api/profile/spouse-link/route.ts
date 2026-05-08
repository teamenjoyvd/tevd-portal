import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

// GET — return own pending/denied spouse_link_requests row, or null
export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles').select('id').eq('clerk_id', userId).single()
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('spouse_link_requests')
    .select('*')
    .eq('requester_id', profile.id)
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

// POST — submit a spouse link request
// Body: { claimed_primary_abo: string }
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, primary_profile_id')
    .eq('clerk_id', userId)
    .single()
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  // Caller must be a guest with no existing primary link
  if (profile.role !== 'guest') {
    return Response.json({ error: 'Only guests can submit a spouse link request' }, { status: 409 })
  }
  if (profile.primary_profile_id) {
    return Response.json({ error: 'Already linked as a spouse' }, { status: 409 })
  }

  // Check for existing pending request (unique constraint on requester_id)
  const { data: existing } = await supabase
    .from('spouse_link_requests')
    .select('id, status')
    .eq('requester_id', profile.id)
    .maybeSingle()
  if (existing?.status === 'pending') {
    return Response.json({ error: 'A pending spouse link request already exists' }, { status: 409 })
  }

  const body = await req.json()
  const { claimed_primary_abo } = body
  if (!claimed_primary_abo) {
    return Response.json({ error: 'claimed_primary_abo is required' }, { status: 400 })
  }

  // Resolve the claimed primary by ABO number
  const { data: primary } = await supabase
    .from('profiles')
    .select('id, role, abo_number, primary_profile_id')
    .eq('abo_number', claimed_primary_abo)
    .neq('id', profile.id)
    .maybeSingle()

  if (!primary) {
    return Response.json(
      { error: `No member found with ABO number ${claimed_primary_abo}.`, error_code: 'primary_not_found' },
      { status: 422 }
    )
  }
  if (primary.role === 'guest') {
    return Response.json(
      { error: 'The referenced ABO holder is not yet a verified member.', error_code: 'primary_not_member' },
      { status: 422 }
    )
  }
  if (primary.primary_profile_id) {
    return Response.json(
      { error: 'The referenced member is already a secondary account and cannot be linked as a primary.', error_code: 'primary_is_secondary' },
      { status: 422 }
    )
  }

  // Check primary has no existing secondary
  const { data: existingSecondary } = await supabase
    .from('profiles')
    .select('id')
    .eq('primary_profile_id', primary.id)
    .maybeSingle()
  if (existingSecondary) {
    return Response.json(
      { error: 'This member already has a linked spouse account.', error_code: 'primary_has_secondary' },
      { status: 422 }
    )
  }

  // Upsert — replace any prior denied request
  const { data, error } = await supabase
    .from('spouse_link_requests')
    .upsert(
      {
        requester_id: profile.id,
        claimed_primary_id: primary.id,
        status: 'pending',
        admin_note: null,
        resolved_at: null,
      },
      { onConflict: 'requester_id' }
    )
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}

// DELETE — cancel own pending request
export async function DELETE() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles').select('id').eq('clerk_id', userId).single()
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const { error } = await supabase
    .from('spouse_link_requests')
    .delete()
    .eq('requester_id', profile.id)
    .eq('status', 'pending')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ cancelled: true })
}
