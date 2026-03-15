import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data: event, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Fetch role requests for this event with profile info
  const { data: roleRequests } = await supabase
    .from('event_role_requests')
    .select('*, profile:profiles(id, first_name, last_name, abo_number)')
    .eq('event_id', id)
    .order('created_at')

  return Response.json({ ...event, role_requests: roleRequests ?? [] })
}