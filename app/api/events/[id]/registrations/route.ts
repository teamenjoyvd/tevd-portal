// ── app/api/events/[id]/registrations/route.ts ────────────────────────────
// GET — registrations for an event, tiered by who is asking (2608-DEV-709).
//
// Replaces app/api/admin/events/[id]/registrations/route.ts, which was
// admin-only. All tiering lives in get_event_registrations_for_viewer
// (20260810000000_2608_feat_709_event_registrations_visibility_rpc.sql):
// admin sees everything, core sees its inclusive LOS subtree, member sees its
// own sign-up plus its own share-link guests. The TypeScript guard below only
// has to exclude guests — it never narrows rows itself, so the roster can
// never widen by a route edit alone.
//
// p_viewer is the caller's own profile.id resolved server-side from Clerk. It
// is never read from the request; that is what makes the DEFINER RPC safe.

import { NextRequest } from 'next/server'
import { withProfile } from '@/lib/supabase/with-profile'
import type { EventRegistration } from '@/app/(dashboard)/calendar/components/popup/types'

type ViewerProfile = {
  id: string
  role: string
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params

  const ctx = await withProfile<ViewerProfile>('id, role')
  if (ctx.response) return ctx.response
  const { supabase, profile } = ctx

  // PGRST116 = PostgREST's "no row for .single()" — a genuinely absent
  // profile. Any other error is a real DB/lookup failure and must not be
  // reported to the caller as a 404.
  if (ctx.error && ctx.error.code !== 'PGRST116') {
    return Response.json({ error: 'Profile lookup failed' }, { status: 500 })
  }
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })
  if (profile.role === 'guest') {
    return Response.json({ error: 'Guests cannot view registrations' }, { status: 403 })
  }

  const { data, error } = await supabase.rpc('get_event_registrations_for_viewer', {
    p_event_id: id,
    p_viewer: profile.id,
  })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Same envelope key as the admin route this replaces, so the client query
  // shape is unchanged.
  return Response.json({ registrations: (data ?? []) as EventRegistration[] })
}
