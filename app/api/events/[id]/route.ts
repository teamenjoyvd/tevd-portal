import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params
  const { userId } = await auth()

  // Unauthenticated — guest view, no slot data, no meeting_url
  if (!userId) {
    const supabase = await createClient()
    const { data: event, error } = await supabase
      .from('calendar_events').select('*').eq('id', id).single()
    if (error?.code === 'PGRST116') return Response.json({ error: 'Not found' }, { status: 404 })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ...event, meeting_url: null, role_slots: [] })
  }

  const supabase = createServiceClient()

  const { data: callerProfile } = await supabase
    .from('profiles').select('id, role').eq('clerk_id', userId).single()
  if (!callerProfile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const { data: event, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('id', id)
    .single()
  if (error?.code === 'PGRST116') return Response.json({ error: 'Not found' }, { status: 404 })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Guests never see role section
  if (callerProfile.role === 'guest') {
    return Response.json({ ...event, meeting_url: null, role_slots: [] })
  }

  // Fetch all slots for this event
  const { data: slots } = await supabase
    .from('event_role_slots')
    .select('role_label')
    .eq('event_id', id)

  // Fetch all requests for this event
  const { data: allRequests } = await supabase
    .from('event_role_requests')
    .select('id, role_label, status, profile_id, profile:profiles!profile_id(first_name, last_name)')
    .eq('event_id', id)

  const requests = allRequests ?? []
  const isAdminOrCore = callerProfile.role === 'admin' || callerProfile.role === 'core'

  // Group requests by role_label once — O(R) — to avoid O(S×R) filter-inside-map
  const requestsByRole = requests.reduce((acc, r) => {
    if (!acc[r.role_label]) acc[r.role_label] = []
    acc[r.role_label].push(r)
    return acc
  }, {} as Record<string, typeof requests>)

  const role_slots = (slots ?? []).map(slot => {
    const slotRequests = requestsByRole[slot.role_label] ?? []
    const approvedReq = slotRequests.find(r => r.status === 'approved')
    const pendingReqs = slotRequests.filter(r => r.status === 'pending')
    const callerReq = slotRequests.find(r => r.profile_id === callerProfile.id) ?? null

    let status: 'open' | 'contested' | 'filled'
    if (approvedReq) {
      status = 'filled'
    } else if (pendingReqs.length > 0) {
      status = 'contested'
    } else {
      status = 'open'
    }

    // Non-admin/core: omit other profiles' identity
    const assigned_profile = approvedReq
      ? isAdminOrCore
        ? (approvedReq.profile as { first_name: string | null; last_name: string | null } | null)
        : { first_name: null, last_name: null }
      : null

    return {
      role_label: slot.role_label,
      status,
      assigned_profile,
      caller_request: callerReq
        ? { id: callerReq.id, status: callerReq.status, role_label: callerReq.role_label }
        : null,
    }
  })

  const meeting_url = event.meeting_url

  return Response.json({ ...event, meeting_url, role_slots })
}
