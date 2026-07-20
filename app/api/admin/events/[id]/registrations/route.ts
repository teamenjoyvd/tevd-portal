// ── app/api/admin/events/[id]/registrations/route.ts ───────────────────────
// GET — return all guest registrations for an event with share attribution.
// Admin-only. Returns name, email, status, attended_at, and sharer_name.

import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerContext } from '@/lib/supabase/guards'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const ctx = await getCallerContext(userId, supabase, 'admin')
  if (ctx.guard) return ctx.guard

  const { id } = await params

  const { data, error } = await supabase
    .from('guest_registrations')
    .select(`
      id,
      name,
      email,
      status,
      attended_at,
      cancelled_at,
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
      id:           g.id,
      name:         g.name,
      email:        g.email,
      status:       g.attended_at !== null ? 'attended' : g.cancelled_at !== null ? 'cancelled' : g.status,
      attended_at:  g.attended_at,
      cancelled_at: g.cancelled_at,
      created_at:   g.created_at,
      sharer_name:  sharerName,
    }
  })

  return Response.json({ registrations })
}
