import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: admin } = await supabase
    .from('profiles').select('role').eq('clerk_id', userId).single()
  if (admin?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const [profileRes, losRes, registrationsRes, paymentsRes, roleRequestsRes] = await Promise.all([
    supabase.from('profiles')
      .select('*, tree_nodes(path, depth)')
      .eq('id', id).single(),
    supabase.from('los_members')
      .select('*')
      .eq('abo_number', (await supabase.from('profiles').select('abo_number').eq('id', id).single()).data?.abo_number ?? ''),
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
) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: admin } = await supabase
    .from('profiles').select('role').eq('clerk_id', userId).single()
  if (admin?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const allowed = ['role', 'abo_number', 'first_name', 'last_name']
  const patch = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  )

  const { data, error } = await supabase
    .from('profiles').update(patch).eq('id', id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // If role changed, sync to Clerk publicMetadata so UserDropdown reflects immediately
  if (patch.role && data?.clerk_id) {
    const clerk = await clerkClient()
    await clerk.users.updateUserMetadata(data.clerk_id, {
      publicMetadata: { role: patch.role },
    })
  }

  return Response.json(data)
}
