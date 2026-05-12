import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export type RoleEvent = {
  id: string
  title: string
  start_time: string
  end_time: string
  slots: {
    HOST: string | null
    SPEAKER: string | null
    PRODUCTS: string | null
  }
}

export async function GET(): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_id', userId)
    .single()

  if (!callerProfile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const rank: Record<string, number> = { guest: 0, member: 1, core: 2, admin: 3 }
  if ((rank[callerProfile.role] ?? -1) < rank.core) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch upcoming events with their slot labels only.
  // Approved occupants are fetched in a second query — PostgREST cannot filter
  // nested rows by status without an RPC, so we never attempt the nested join.
  const { data: events, error } = await supabase
    .from('calendar_events')
    .select(`
      id,
      title,
      start_time,
      end_time,
      event_role_slots ( role_label )
    `)
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const SLOT_LABELS = ['HOST', 'SPEAKER', 'PRODUCTS'] as const

  // Filter to events that have at least one configured slot
  const eventsWithSlots = (events ?? []).filter(
    e => e.event_role_slots && e.event_role_slots.length > 0
  )

  if (eventsWithSlots.length === 0) return Response.json([])

  const eventIds = eventsWithSlots.map(e => e.id)

  // Fetch approved requests separately (correct approach — no nested filter needed)
  const { data: approvedRequests } = await supabase
    .from('event_role_requests')
    .select('event_id, role_label, profile:profiles!profile_id ( first_name, last_name )')
    .in('event_id', eventIds)
    .eq('status', 'approved')

  // Build lookup: eventId -> roleLabel -> occupant name
  const occupantMap: Record<string, Record<string, string>> = {}
  for (const req of approvedRequests ?? []) {
    if (!occupantMap[req.event_id]) occupantMap[req.event_id] = {}
    const profile = req.profile as { first_name: string | null; last_name: string | null } | null
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
    if (name) occupantMap[req.event_id][req.role_label] = name
  }

  const result: RoleEvent[] = eventsWithSlots.map(event => {
    const eventOccupants = occupantMap[event.id] ?? {}

    // Only expose slots that are configured on this event
    const configuredLabels = new Set(
      (event.event_role_slots ?? []).map(s => s.role_label)
    )

    return {
      id: event.id,
      title: event.title,
      start_time: event.start_time,
      end_time: event.end_time,
      slots: {
        HOST:     configuredLabels.has('HOST')     ? (eventOccupants['HOST']     ?? null) : null,
        SPEAKER:  configuredLabels.has('SPEAKER')  ? (eventOccupants['SPEAKER']  ?? null) : null,
        PRODUCTS: configuredLabels.has('PRODUCTS') ? (eventOccupants['PRODUCTS'] ?? null) : null,
      },
    }
  })

  return Response.json(result)
}
