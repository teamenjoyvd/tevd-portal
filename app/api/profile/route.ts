import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('clerk_id', userId)
    .single()

  if (error) {
    // PGRST116 = no rows returned — user has no profile yet (webhook not fired)
    if (error.code === 'PGRST116') {
      return Response.json({ error: 'Profile not found' }, { status: 404 })
    }
    return Response.json({ error: error.message }, { status: 500 })
  }

  // Fetch upline and verRequest in parallel, gated on profile state
  const [upline, verRequest] = await Promise.all([
    data.abo_number
      ? (async () => {
          const { data: losMember } = await supabase
            .from('los_members')
            .select('sponsor_abo_number')
            .eq('abo_number', data.abo_number)
            .single()

          if (!losMember?.sponsor_abo_number) {
            return { upline_name: null, upline_abo_number: null }
          }

          const { data: uplineMember } = await supabase
            .from('los_members')
            .select('abo_number, name')
            .eq('abo_number', losMember.sponsor_abo_number)
            .single()

          return {
            upline_name: uplineMember?.name ?? null,
            upline_abo_number: uplineMember?.abo_number ?? null,
          }
        })()
      : Promise.resolve(null),
    data.role === 'guest'
      ? (async () => {
          const { data: req } = await supabase
            .from('abo_verification_requests')
            .select('id, claimed_abo, claimed_upline_abo, status, admin_note, created_at, request_type')
            .eq('profile_id', data.id)
            .maybeSingle()
          return req ?? null
        })()
      : Promise.resolve(null),
  ])

  return Response.json({ ...data, upline, verRequest })
}

export async function PATCH(req: Request): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const body = await req.json() as Record<string, unknown>

  // Whitelist updatable fields — clerk_id, role, abo_number not patchable here
  const allowed = [
    'first_name', 'last_name', 'display_names',
    'document_active_type',
    'id_number', 'passport_number', 'valid_through',
    'phone', 'contact_email',
    'ui_prefs',
  ]
  const patch = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  )

  // ui_prefs must be merged, not replaced — callers send partial shapes
  // (e.g. { font_size: 'lg' }) and must not clobber bento_order / bento_collapsed.
  if (patch.ui_prefs !== undefined) {
    const { data: existing, error: fetchError } = await supabase
      .from('profiles')
      .select('ui_prefs')
      .eq('clerk_id', userId)
      .single()

    if (fetchError) return Response.json({ error: fetchError.message }, { status: 500 })

    patch.ui_prefs = {
      ...(existing?.ui_prefs as Record<string, unknown> ?? {}),
      ...(patch.ui_prefs as Record<string, unknown>),
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('clerk_id', userId)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
