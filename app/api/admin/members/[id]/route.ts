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
    profile:      profileRes.data,
    los:          losRes.data?.[0] ?? null,
    registrations: registrationsRes.data ?? [],
    payments:     paymentsRes.data ?? [],
    roleRequests: roleRequestsRes.data ?? [],
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
  const allowed = ['role', 'abo_number', 'first_name', 'last_name']
  const patch = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  )

  // Role change: use atomic RPC so the profile update and audit row
  // are committed in a single transaction. A failed audit insert rolls
  // back the role change — no silent audit gaps.
  if (patch.role) {
    const { data: rows, error: rpcError } = await supabase
      .rpc('patch_member_role', {
        p_profile_id: id,
        p_new_role:   patch.role as 'admin' | 'core' | 'member' | 'guest',
        p_changed_by: userId,
      })
    if (rpcError) return Response.json({ error: rpcError.message }, { status: 500 })

    const data = rows?.[0] ?? null

    // Sync to Clerk publicMetadata so UserDropdown reflects immediately
    if (data?.clerk_id) {
      const clerk = await clerkClient()
      await clerk.users.updateUserMetadata(data.clerk_id, {
        publicMetadata: { role: patch.role },
      })
    }

    // Apply any remaining non-role fields from the patch, if present
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

  // Non-role fields only
  const { data, error } = await supabase
    .from('profiles').update(patch).eq('id', id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(data)
}
