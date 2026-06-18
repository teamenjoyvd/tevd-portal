import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import RolesClient from './components/RolesClient'
import type { RoleEvent } from '@/app/api/roles/route'

const ROLE_RANK: Record<string, number> = { guest: 0, member: 1, core: 2, admin: 3 }

export default async function RolesPage() {
  const { userId } = await auth()
  if (!userId) redirect('/calendar')

  const supabase = createServiceClient()

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_id', userId)
    .single()

  if (!callerProfile || (ROLE_RANK[callerProfile.role] ?? -1) < ROLE_RANK.core) {
    redirect('/calendar')
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const quarter = Math.floor(month / 3)
  const startMonth = quarter * 3
  const startOfQuarter = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0, 0))
  const startOfNextQuarter = new Date(Date.UTC(year, startMonth + 3, 1, 0, 0, 0, 0))

  // Fetch current quarter events with slots
  const { data: events } = await supabase
    .from('calendar_events')
    .select('id, title, start_time, end_time, event_role_slots ( role_label )')
    .gte('start_time', startOfQuarter.toISOString())
    .lt('start_time', startOfNextQuarter.toISOString())
    .order('start_time', { ascending: true })

  const eventsWithSlots = (events ?? []).filter(
    e => e.event_role_slots && e.event_role_slots.length > 0
  )

  if (eventsWithSlots.length === 0) {
    return <RolesClient events={[]} />
  }

  const eventIds = eventsWithSlots.map(e => e.id)

  const { data: approvedRequests } = await supabase
    .from('event_role_requests')
    .select('event_id, role_label, profile:profiles!profile_id ( first_name, last_name )')
    .in('event_id', eventIds)
    .eq('status', 'approved')

  // Build occupant lookup
  const occupantMap: Record<string, Record<string, string>> = {}
  for (const req of approvedRequests ?? []) {
    if (!occupantMap[req.event_id]) occupantMap[req.event_id] = {}
    const profile = req.profile as { first_name: string | null; last_name: string | null } | null
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
    if (name) occupantMap[req.event_id][req.role_label] = name
  }

  const roleEvents: RoleEvent[] = eventsWithSlots.map(event => ({
    id: event.id,
    title: event.title,
    start_time: event.start_time,
    end_time: event.end_time,
    slots: {
      HOST:     occupantMap[event.id]?.['HOST']     ?? null,
      SPEAKER:  occupantMap[event.id]?.['SPEAKER']  ?? null,
      PRODUCTS: occupantMap[event.id]?.['PRODUCTS'] ?? null,
    },
  }))

  return <RolesClient events={roleEvents} />
}
