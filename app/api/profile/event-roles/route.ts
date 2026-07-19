import { withProfile } from '@/lib/supabase/with-profile'

export async function GET() {
  const ctx = await withProfile<{ id: string }>('id')
  if (ctx.response) return ctx.response
  const { supabase, profile } = ctx

  if (!profile?.id) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('event_role_requests')
    .select('id, role_label, status, note, created_at, calendar_events(id, title, start_time)')
    .eq('profile_id', profile.id)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}
