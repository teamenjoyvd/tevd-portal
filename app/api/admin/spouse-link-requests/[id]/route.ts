import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/supabase/guards'

// PATCH removed — admin cannot act on spouse link requests.
// Approval/denial is now performed by the primary member via
// POST /api/profile/spouse-link/[action].
//
// GET remains for the read-only Approval Hub view.

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const guard = await requireAdmin(userId, supabase)
  if (guard) return guard

  const { id: requestId } = await params

  const { data, error } = await supabase
    .from('spouse_link_requests')
    .select(`
      id, status, admin_note, created_at, resolved_at,
      requester:profiles!spouse_link_requests_requester_id_fkey(id, first_name, last_name, contact_email, role),
      claimed_primary:profiles!spouse_link_requests_claimed_primary_id_fkey(id, first_name, last_name, abo_number, role)
    `)
    .eq('id', requestId)
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(data)
}
