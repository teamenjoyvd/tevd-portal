import type { createServiceClient } from '@/lib/supabase/service'
import type { ZoomPort } from '@/lib/server/tickets/zoom-port'
import { approveRegistrant, createRegistrant, deleteRegistrant, ZoomError } from './client'

/** Split at the last space. Zoom needs a last name, so one word gets "-". */
export function splitName(name: string): { first_name: string; last_name: string } {
  const trimmed = name.trim().replace(/\s+/g, ' ')
  const at = trimmed.lastIndexOf(' ')
  return at === -1
    ? { first_name: trimmed, last_name: '-' }
    : { first_name: trimmed.slice(0, at), last_name: trimmed.slice(at + 1) }
}

export function createZoomPort(supabase: ReturnType<typeof createServiceClient>): ZoomPort {
  async function session(eventId: string): Promise<{ eventRef: string; sessionRef: string }> {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('zoom_event_ref, zoom_session_ref')
      .eq('id', eventId)
      .maybeSingle()
    if (error) throw error
    if (!data?.zoom_event_ref || !data.zoom_session_ref) throw new ZoomError('permanent', 0)
    return { eventRef: data.zoom_event_ref, sessionRef: data.zoom_session_ref }
  }

  return {
    async register({ eventId, name, email }) {
      const { eventRef, sessionRef } = await session(eventId)
      const created = await createRegistrant(eventRef, sessionRef, { email, ...splitName(name) })
      await approveRegistrant(eventRef, sessionRef, created.registrant_id, email)
      return { ref: created.registrant_id, joinLink: created.join_url }
    },
    async cancel({ eventId, ref }) {
      const { eventRef, sessionRef } = await session(eventId)
      await deleteRegistrant(eventRef, sessionRef, ref)
    },
  }
}
