import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export type MyTicket = {
  id: string
  code: string
  qr_token: string
  entries_total: number
  entries_left: number
  expires_at: string
  void: boolean
  history: { id: string; title: string; start_time: string; attendee: string; mode: string }[]
}

/** The caller's own paid and free passes. Personal join links are never included. */
export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile, error: profileError } = await supabase.from('profiles').select('id').eq('clerk_id', userId).maybeSingle()
  if (profileError) return Response.json({ error: 'Could not load' }, { status: 500 })
  if (profile === null) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('ticket_passes')
    .select(`
      id, unlock_code, qr_token, entries_total, expires_at, status, ticket_products!inner(kind),
      ticket_admissions(id, attendee_name, mode, status, created_at, calendar_events(title, start_time))
    `)
    .eq('holder_profile_id', profile.id)
    // A free registration has no code to show.
    .neq('ticket_products.kind', 'free_registration')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[tickets/mine]', error.code)
    return Response.json({ error: 'Could not load' }, { status: 500 })
  }

  return Response.json(data.map((p): MyTicket => {
    const used = p.ticket_admissions.filter((a) => a.status === 'pending_zoom' || a.status === 'active')
    return {
      id: p.id,
      code: p.unlock_code,
      qr_token: p.qr_token,
      entries_total: p.entries_total,
      entries_left: p.entries_total - used.length,
      expires_at: p.expires_at,
      void: p.status === 'void',
      history: used
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((a) => ({
          id: a.id,
          title: a.calendar_events.title,
          start_time: a.calendar_events.start_time,
          attendee: a.attendee_name,
          mode: a.mode,
        })),
    }
  }))
}
