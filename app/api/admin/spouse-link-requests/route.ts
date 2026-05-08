import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/supabase/guards'

// GET — list all pending spouse link requests with requester + claimed_primary profile data
export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const guard = await requireAdmin(userId, supabase)
  if (guard) return guard

  const { data, error } = await supabase
    .from('spouse_link_requests')
    .select(`
      id,
      status,
      admin_note,
      created_at,
      resolved_at,
      requester:profiles!requester_id (id, first_name, last_name, contact_email, role),
      claimed_primary:profiles!claimed_primary_id (id, first_name, last_name, abo_number, role)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
