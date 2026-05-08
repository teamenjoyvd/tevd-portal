import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerContext } from '@/lib/supabase/guards'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const ctx = await getCallerContext(userId, supabase, 'admin')
  if (ctx.guard) return ctx.guard

  const profileRes = await supabase
    .from('profiles')
    .select('*, tree_nodes(path, depth)')
    .eq('id', id)
    .single()

  const aboNumber = profileRes.data?.abo_number ?? ''

  const [losRes, registrationsRes, paymentsRes, roleRequestsRes] = await Promise.all([
    supabase.from('los_members')
      .select('*')
      .eq('abo_number', aboNumber),
    supabase.from('trip_registrations')
      .select('*, trip:trips(title, destination, start_date)')
      .eq('profile_id', id)
      .order('created_at', { ascending: false }),
    supabase.from('payments')
      .select('*, trip:trips(title), item:payable_items(title)')
      .eq('profile_id', id)
      .order('transaction_date', { ascending: false }),
    supabase.from('event_role_requests')
      .select('*, event:calendar_events(title, start_time)')
      .eq('profile_id', id)
      .order('created_at', { ascending: false }),
  ])

  return Response.json({
    profile:       profileRes.data,
    los:           losRes.data?.[0] ?? null,
    registrations: registrationsRes.data ?? [],
    payments:      paymentsRes.data ?? [],
    roleRequests:  roleRequestsRes.data ?? [],
  })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const ctx = await getCallerContext(userId, supabase, 'admin')
  if (ctx.guard) return ctx.guard

  const body = await req.json()

  // --- Action: promote_to_primary ---
  // Swaps primary/secondary roles between two linked profiles.
  // WARNING: calls rebuild_tree_paths — high-risk. Admin UI must surface a warning dialog.
  if (body.action === 'promote_to_primary') {
    const { secondary_id } = body
    if (!secondary_id) {
      return Response.json({ error: 'secondary_id is required' }, { status: 400 })
    }

    // Verify the relationship is valid before calling the RPC
    const { data: secondary } = await supabase
      .from('profiles')
      .select('id, primary_profile_id')
      .eq('id', secondary_id)
      .single()
    if (!secondary) return Response.json({ error: 'Secondary profile not found' }, { status: 404 })
    if (secondary.primary_profile_id !== id) {
      return Response.json(
        { error: 'Profile is not a secondary of the specified primary.', error_code: 'not_linked' },
        { status: 409 }
      )
    }

    const { error: rpcErr } = await supabase
      .rpc('promote_to_primary', {
        p_current_primary_id:   id,
        p_current_secondary_id: secondary_id,
      })
    if (rpcErr) return Response.json({ error: rpcErr.message }, { status: 500 })

    return Response.json(
      {
        promoted: true,
        warning: 'LOS tree paths have been rebuilt. Verify tree structure before next LOS import.',
      },
      { status: 200 }
    )
  }

  // --- Action: dissolve_partnership ---
  // Demotes a secondary profile back to guest, clears abo_number and primary_profile_id.
  if (body.action === 'dissolve_partnership') {
    // Only valid on a secondary profile (id = the secondary)
    const { data: target } = await supabase
      .from('profiles')
      .select('id, primary_profile_id, role, clerk_id')
      .eq('id', id)
      .single()
    if (!target) return Response.json({ error: 'Profile not found' }, { status: 404 })
    if (!target.primary_profile_id) {
      return Response.json(
        { error: 'Profile is not a secondary account. Cannot dissolve.', error_code: 'not_secondary' },
        { status: 400 }
      )
    }

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ primary_profile_id: null, abo_number: null, role: 'guest' })
      .eq('id', id)
    if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 })

    await supabase.from('role_change_audit').insert({
      profile_id: id,
      changed_by: userId,
      old_role: target.role,
      new_role: 'guest',
      note: 'Partnership dissolved by admin',
    })

    if (target.clerk_id) {
      const clerk = await clerkClient()
      await clerk.users.updateUserMetadata(target.clerk_id, {
        publicMetadata: { role: 'guest' },
      })
    }

    return Response.json({ dissolved: true }, { status: 200 })
  }

  // --- Deletion block guard ---
  // Check before any demotion-to-guest whether a secondary exists.
  // (Full DELETE handler not present; guard applies to any role downgrade.)
  if (body.role === 'guest') {
    const { data: secondary } = await supabase
      .from('profiles')
      .select('id')
      .eq('primary_profile_id', id)
      .maybeSingle()
    if (secondary) {
      return Response.json(
        {
          error: 'Cannot demote — a linked spouse account exists. Promote them to primary or dissolve the partnership first.',
          error_code: 'has_secondary',
        },
        { status: 409 }
      )
    }
  }

  // --- Standard field patch ---
  const allowed = ['role', 'abo_number', 'first_name', 'last_name']
  const patch = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  )

  if (patch.role) {
    const { data: rows, error: rpcError } = await supabase
      .rpc('patch_member_role', {
        p_profile_id: id,
        p_new_role:   patch.role as 'admin' | 'core' | 'member' | 'guest',
        p_changed_by: userId,
      })
    if (rpcError) return Response.json({ error: rpcError.message }, { status: 500 })

    const data = rows?.[0] ?? null

    if (data?.clerk_id) {
      const clerk = await clerkClient()
      await clerk.users.updateUserMetadata(data.clerk_id, {
        publicMetadata: { role: patch.role },
      })
    }

    const nonRolePatch = Object.fromEntries(
      Object.entries(patch).filter(([k]) => k !== 'role')
    )
    if (Object.keys(nonRolePatch).length > 0) {
      const { data: updated, error: updateError } = await supabase
        .from('profiles').update(nonRolePatch).eq('id', id).select().single()
      if (updateError) return Response.json({ error: updateError.message }, { status: 500 })
      return Response.json(updated)
    }

    return Response.json(data)
  }

  const { data, error } = await supabase
    .from('profiles').update(patch).eq('id', id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(data)
}
