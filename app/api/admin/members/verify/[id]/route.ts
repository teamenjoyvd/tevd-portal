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

  // Fetch the request — needed for Clerk sync and notification copy after approval
  const { data: verReq } = await supabase
    .from('abo_verification_requests')
    .select('*')
    .eq('id', id)
    .single()

  if (!verReq) return Response.json({ error: 'Request not found' }, { status: 404 })

  if (action === 'approve') {
    // Single atomic RPC: UPDATE profiles + UPDATE abo_verification_requests
    // + upsert_tree_node all in one transaction.
    // If this fails, no partial state is written.
    const { error: rpcErr } = await supabase
      .rpc('approve_member_verification', {
        p_request_id: id,
        p_admin_note: admin_note ?? null,
      })

    if (rpcErr) return Response.json({ error: rpcErr.message }, { status: 500 })

    // Audit log: guest → member via verification approval
    await supabase.from('role_change_audit').insert({
      profile_id: verReq.profile_id,
      changed_by: userId,
      old_role: 'guest',
      new_role: 'member',
      note: admin_note ?? null,
    })

    // Sync role to Clerk publicMetadata so UserDropdown reflects immediately.
    // Best-effort: Supabase is already committed above.
    const { data: promoted } = await supabase
      .from('profiles').select('clerk_id').eq('id', verReq.profile_id).single()
    if (promoted?.clerk_id) {
      const clerk = await clerkClient()
      await clerk.users.updateUserMetadata(promoted.clerk_id, {
        publicMetadata: { role: 'member' },
      })
    }

    // Notify the user. Best-effort: failure here does not affect approval state.
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

    // Read back the resolved request for the response
    const { data, error } = await supabase
      .from('abo_verification_requests')
      .select()
      .eq('id', id)
      .single()

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json(data)
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

    // Update the request status
    const { data, error } = await supabase
      .from('abo_verification_requests')
      .update({ status: 'denied', resolved_at: new Date().toISOString(), admin_note: admin_note ?? null })
      .eq('id', id)
      .select().single()

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json(data)
  }
}
