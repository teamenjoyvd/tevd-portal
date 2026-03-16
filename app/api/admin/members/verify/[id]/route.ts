import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: admin } = await supabase
    .from('profiles').select('role').eq('clerk_id', userId).single()
  if (admin?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { action, admin_note } = await req.json()
  if (!['approve', 'deny'].includes(action)) {
    return Response.json({ error: 'action must be approve or deny' }, { status: 400 })
  }

  // Get the request
  const { data: verReq } = await supabase
    .from('abo_verification_requests')
    .select('*')
    .eq('id', id)
    .single()

  if (!verReq) return Response.json({ error: 'Request not found' }, { status: 404 })

  if (action === 'approve') {
    // Set abo_number + promote to member on the profile
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ abo_number: verReq.claimed_abo, role: 'member' })
      .eq('id', verReq.profile_id)

    if (profileErr) return Response.json({ error: profileErr.message }, { status: 500 })

    // Notify the user
    const { data: profile } = await supabase
      .from('profiles').select('first_name').eq('id', verReq.profile_id).single()

    await supabase.from('notifications').insert({
      profile_id: verReq.profile_id,
      type: 'role_request',
      title: 'ABO verification approved',
      message: `Welcome ${profile?.first_name ?? ''}! Your ABO number ${verReq.claimed_abo} has been verified. You are now a Member.`,
      action_url: '/profile',
    })
  } else {
    // Notify denial
    await supabase.from('notifications').insert({
      profile_id: verReq.profile_id,
      type: 'role_request',
      title: 'ABO verification not approved',
      message: admin_note
        ? `Your verification request was not approved: ${admin_note}`
        : 'Your ABO verification request was not approved. Please check your details and try again.',
      action_url: '/profile',
    })
  }

  // Update the request status
  const { data, error } = await supabase
    .from('abo_verification_requests')
    .update({ status: action === 'approve' ? 'approved' : 'denied', resolved_at: new Date().toISOString(), admin_note: admin_note ?? null })
    .eq('id', id)
    .select().single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}