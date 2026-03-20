import { auth, clerkClient } from '@clerk/nextjs/server'
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
    if (verReq.request_type === 'manual') {
      // Manual path: member has no ABO — store upline, place placeholder tree node
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ role: 'member', upline_abo_number: verReq.claimed_upline_abo })
        .eq('id', verReq.profile_id)

      if (profileErr) return Response.json({ error: profileErr.message }, { status: 500 })

      // Cast to any: generated types declare p_abo_number as string but the
      // function accepts NULL to trigger the no-ABO placeholder path.
      const { error: treeErr } = await supabase
        .rpc('upsert_tree_node', {
          p_profile_id: verReq.profile_id,
          p_abo_number: null,
          p_sponsor_abo_number: verReq.claimed_upline_abo,
        } as any)

      if (treeErr) return Response.json({ error: treeErr.message }, { status: 500 })
    } else {
      // Standard path: set abo_number + promote to member
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ abo_number: verReq.claimed_abo, role: 'member' })
        .eq('id', verReq.profile_id)

      if (profileErr) return Response.json({ error: profileErr.message }, { status: 500 })
    }

    // Sync role to Clerk publicMetadata so UserDropdown reflects immediately
    const { data: promoted } = await supabase
      .from('profiles').select('clerk_id').eq('id', verReq.profile_id).single()
    if (promoted?.clerk_id) {
      const clerk = await clerkClient()
      await clerk.users.updateUserMetadata(promoted.clerk_id, {
        publicMetadata: { role: 'member' },
      })
    }

    // Notify the user
    const { data: profile } = await supabase
      .from('profiles').select('first_name').eq('id', verReq.profile_id).single()

    const notifMessage = verReq.request_type === 'manual'
      ? `Welcome ${profile?.first_name ?? ''}! Your manual verification has been approved. You are now a Member.`
      : `Welcome ${profile?.first_name ?? ''}! Your ABO number ${verReq.claimed_abo} has been verified. You are now a Member.`

    await supabase.from('notifications').insert({
      profile_id: verReq.profile_id,
      type: 'role_request',
      title: 'Verification approved',
      message: notifMessage,
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
