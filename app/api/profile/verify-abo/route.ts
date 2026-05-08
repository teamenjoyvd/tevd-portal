import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles').select('id, role, abo_number').eq('clerk_id', userId).single()
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })
  if (profile.abo_number) return Response.json({ error: 'ABO already verified' }, { status: 409 })
  if (profile.role !== 'guest') return Response.json({ error: 'Already verified' }, { status: 409 })

  const body = await req.json()
  const request_type: 'standard' | 'manual' = body.request_type === 'manual' ? 'manual' : 'standard'
  const { claimed_abo, claimed_upline_abo } = body

  if (request_type === 'standard') {
    if (!claimed_abo || !claimed_upline_abo) {
      return Response.json({ error: 'claimed_abo and claimed_upline_abo are required' }, { status: 400 })
    }

    // LOS existence check
    const { data: losMember } = await supabase
      .from('los_members')
      .select('abo_number, sponsor_abo_number, last_synced_at')
      .eq('abo_number', claimed_abo)
      .maybeSingle()

    if (!losMember) {
      const { data: anyLos } = await supabase
        .from('los_members')
        .select('last_synced_at')
        .order('last_synced_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const losAge = anyLos?.last_synced_at
        ? Math.floor((Date.now() - new Date(anyLos.last_synced_at).getTime()) / 86_400_000)
        : null
      return Response.json(
        {
          error: losAge !== null
            ? `ABO ${claimed_abo} not found in LOS data (${losAge} days old). Check your number or ask your admin to re-import the LOS.`
            : `ABO ${claimed_abo} not found in LOS data. Ask your admin to import the LOS.`,
          error_code: 'abo_not_in_los',
        },
        { status: 422 }
      )
    }

    // Sponsor mismatch check
    if (losMember.sponsor_abo_number !== claimed_upline_abo) {
      return Response.json(
        { error: `Your sponsor ABO does not match the LOS record for ${claimed_abo}.`, error_code: 'upline_mismatch' },
        { status: 422 }
      )
    }

    // Duplicate ABO check
    // ADR-016: if the existing holder is a primary (primary_profile_id IS NULL),
    // surface a specific error_code so the UI can offer the spouse link flow.
    const { data: existingHolder } = await supabase
      .from('profiles')
      .select('id, primary_profile_id')
      .eq('abo_number', claimed_abo)
      .neq('id', profile.id)
      .maybeSingle()

    if (existingHolder) {
      if (existingHolder.primary_profile_id === null) {
        // The holder is a primary — this guest may be their spouse
        return Response.json(
          {
            error: `This ABO is already registered. If you are the co-owner, use the Spouse Link option on your profile.`,
            error_code: 'abo_has_primary',
            primary_profile_id: existingHolder.id,
          },
          { status: 409 }
        )
      }
      // The holder is a secondary — generic already-claimed error
      return Response.json(
        { error: `ABO ${claimed_abo} is already registered to another account.`, error_code: 'abo_already_claimed' },
        { status: 409 }
      )
    }
  } else {
    // Manual path
    if (!claimed_upline_abo) {
      return Response.json({ error: 'claimed_upline_abo is required' }, { status: 400 })
    }

    const { data: uplineLos } = await supabase
      .from('los_members')
      .select('abo_number')
      .eq('abo_number', claimed_upline_abo)
      .maybeSingle()

    if (!uplineLos) {
      return Response.json(
        { error: `Upline ABO ${claimed_upline_abo} not found in LOS data. Check the number or contact your admin.`, error_code: 'upline_not_in_los' },
        { status: 422 }
      )
    }
  }

  const { data, error } = await supabase
    .from('abo_verification_requests')
    .upsert(
      {
        profile_id: profile.id,
        claimed_abo: request_type === 'manual' ? null : claimed_abo,
        claimed_upline_abo,
        request_type,
        status: 'pending',
        resolved_at: null,
      },
      { onConflict: 'profile_id' }
    )
    .select().single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}

export async function DELETE() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles').select('id').eq('clerk_id', userId).single()
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const { error } = await supabase
    .from('abo_verification_requests')
    .delete()
    .eq('profile_id', profile.id)
    .eq('status', 'pending')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ cancelled: true })
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles').select('id').eq('clerk_id', userId).single()
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('abo_verification_requests')
    .select('*')
    .eq('profile_id', profile.id)
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
