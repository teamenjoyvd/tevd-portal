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
  } else {
    if (!claimed_upline_abo) {
      return Response.json({ error: 'claimed_upline_abo is required' }, { status: 400 })
    }
  }

  // Upsert — replace any existing pending request
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
