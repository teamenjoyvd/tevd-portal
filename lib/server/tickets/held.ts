import { cookies } from 'next/headers'
import type { createServiceClient } from '@/lib/supabase/service'
import { holdsDevice } from './device'

type ServiceClient = ReturnType<typeof createServiceClient>
export type JoinablePlace = { id: string; name: string }

const PREFIX = 'tkt_'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const deviceCookieName = (admissionId: string) => `${PREFIX}${admissionId}`

async function joinable(supabase: ServiceClient, eventId: string, ids: string[]) {
  const { data, error } = await supabase
    .from('ticket_admissions')
    .select('id, attendee_name, device_token_hash')
    .in('id', ids)
    .eq('event_id', eventId)
    .eq('mode', 'online')
    .in('status', ['pending_zoom', 'active'])
    .order('created_at')
  if (error) throw error
  return data
}

/** Places whose cookie on this device matches the stored hash. Any other cookie is ignored. */
export async function heldAdmissions(supabase: ServiceClient, eventId: string): Promise<JoinablePlace[]> {
  const tokens = new Map(
    (await cookies()).getAll()
      .filter((c) => c.name.startsWith(PREFIX) && UUID.test(c.name.slice(PREFIX.length)))
      .map((c) => [c.name.slice(PREFIX.length).toLowerCase(), c.value]),
  )
  if (tokens.size === 0) return []
  return (await joinable(supabase, eventId, [...tokens.keys()]))
    .filter((r) => holdsDevice(r.device_token_hash, tokens.get(r.id)))
    .map((r) => ({ id: r.id, name: r.attendee_name }))
}

export async function findJoinable(supabase: ServiceClient, eventId: string, admissionId: string): Promise<JoinablePlace | null> {
  if (!UUID.test(admissionId)) return null
  const row = (await joinable(supabase, eventId, [admissionId]))[0]
  return row === undefined ? null : { id: row.id, name: row.attendee_name }
}
