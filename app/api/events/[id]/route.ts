import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { userId } = await auth()

  if (!userId) {
    const { id } = await params
    const supabase = await createClient()
    const { data: event, error } = await supabase
      .from('calendar_events').select('*').eq('id', id).single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ...event, role_requests: [], caller_request: null })
  }

  const { id } = await params
  const supabase = createServiceClient()

  const { data: callerProfile } = await supabase
    .from('profiles').select('id, role').eq('clerk_id', userId).single()
  if (!callerProfile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const { data: event, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Always fetch the caller's own request — no PII leak, it's their own data.
  const { data: callerRequest } = await supabase
    .from('event_role_requests')
    .select('id, role_label, status, note')
    .eq('event_id', id)
    .eq('profile_id', callerProfile.id)
    .maybeSingle()

  // Role requests for other people (PII: first_name, last_name, abo_number) — only admins and core see all.
  if (callerProfile.role !== 'admin' && callerProfile.role !== 'core') {
    return Response.json({ ...event, role_requests: [], caller_request: callerRequest ?? null })
  }

  const { data: roleRequests } = await supabase
    .from('event_role_requests')
    .select('*, profile:profiles(id, first_name, last_name, abo_number)')
    .eq('event_id', id)
    .order('created_at')

  return Response.json({ ...event, role_requests: roleRequests ?? [], caller_request: callerRequest ?? null })
}
