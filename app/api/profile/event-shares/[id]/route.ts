// ── app/api/profile/event-shares/[id]/route.ts ──────────────────────────────
// DELETE — soft-revoke a share link owned by the authenticated member.

import { withProfile } from '@/lib/supabase/with-profile'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params

  const ctx = await withProfile()
  if (ctx.response) return ctx.response
  const { supabase, profile } = ctx

  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const { data: link, error: updateError } = await supabase
    .from('event_share_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('profile_id', profile.id)
    .select('id')
    .single()

  if (updateError || !link) return Response.json({ error: 'Share link not found' }, { status: 404 })

  return Response.json({ success: true })
}
