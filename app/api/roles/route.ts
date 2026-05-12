import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

type RoleSlotRow = {
  role_label: string
  event_role_requests: {
    profile: {
      first_name: string | null
      last_name: string | null
    } | null
  }[] | null
}

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

  // Fetch events that have at least one slot, upcoming only
  const { data: events, error } = await supabase
    .from('calendar_events')
    .select(`
      id,
      title,
      start_time,
      end_time,
      event_role_slots (
        role_label,
        event_role_requests (
          profile:profiles!profile_id ( first_name, last_name )
        )
      )
    `)
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Filter to only events that actually have slots configured
  const eventsWithSlots = (events ?? []).filter(
    e => e.event_role_slots && e.event_role_slots.length > 0
  )

  const SLOT_LABELS = ['HOST', 'SPEAKER', 'PRODUCTS'] as const

  const result: RoleEvent[] = eventsWithSlots.map(event => {
    const slotMap: Record<string, string | null> = { HOST: null, SPEAKER: null, PRODUCTS: null }

    for (const slot of (event.event_role_slots as RoleSlotRow[])) {
      const label = slot.role_label as typeof SLOT_LABELS[number]
      if (!SLOT_LABELS.includes(label)) continue

      // event_role_slots -> event_role_requests is a nested array filtered to approved only
      // by the join — but PostgREST returns all requests; we filter status client-side
      // Note: the join here doesn't filter by status — we need to handle that.
      // Since we only want approved, we take the first request in the array
      // (the RPC/trigger enforces one approved per slot, so at most one exists).
      // However PostgREST nested select returns ALL requests — we cannot filter
      // nested rows in PostgREST without an RPC. Safe approach: fetch separately below.
      slotMap[label] = null
    }

    return {
      id: event.id,
      title: event.title,
      start_time: event.start_time,
      end_time: event.end_time,
      slots: slotMap as RoleEvent['slots'],
    }
  })

  // PostgREST cannot filter nested rows — fetch approved requests separately
  if (result.length === 0) return Response.json(result)

  const eventIds = result.map(e => e.id)

  const { data: approvedRequests } = await supabase
    .from('event_role_requests')
    .select('event_id, role_label, profile:profiles!profile_id ( first_name, last_name )')
    .in('event_id', eventIds)
    .eq('status', 'approved')

  // Build a lookup: eventId -> roleLabel -> occupant name
  const occupantMap: Record<string, Record<string, string>> = {}
  for (const req of approvedRequests ?? []) {
    if (!occupantMap[req.event_id]) occupantMap[req.event_id] = {}
    const profile = req.profile as { first_name: string | null; last_name: string | null } | null
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
    if (name) occupantMap[req.event_id][req.role_label] = name
  }

  // Merge occupant data into result
  for (const event of result) {
    const eventOccupants = occupantMap[event.id] ?? {}
    event.slots.HOST     = eventOccupants['HOST']     ?? null
    event.slots.SPEAKER  = eventOccupants['SPEAKER']  ?? null
    event.slots.PRODUCTS = eventOccupants['PRODUCTS'] ?? null
  }

  return Response.json(result)
}
