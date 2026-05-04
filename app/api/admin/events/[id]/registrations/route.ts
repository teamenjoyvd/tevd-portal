// ── app/api/admin/events/[id]/registrations/route.ts ───────────────────────
// GET — return all guest registrations for an event with share attribution.
// Admin-only. Returns name, email, status, attended_at, and sharer_name.

import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_id', userId)
    .single()

  if (!caller || caller.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const { data, error } = await supabase
    .from('guest_registrations')
    .select(`
      id,
      name,
      email,
      status,
      attended_at,
      created_at,
      share_link:event_share_links (
        profile:profiles ( first_name, last_name )
      )
    `)
    .eq('event_id', id)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const registrations = (data ?? []).map(g => {
    const shareLink = g.share_link as unknown as { profile: { first_name: string; last_name: string } | null } | null
    const sharerName = shareLink?.profile
      ? `${shareLink.profile.first_name} ${shareLink.profile.last_name}`.trim()
      : null
    return {
      id:          g.id,
      name:        g.name,
      email:       g.email,
      status:      g.status,
      attended_at: g.attended_at,
      created_at:  g.created_at,
      sharer_name: sharerName,
    }
  })

  return Response.json({ registrations })
}
