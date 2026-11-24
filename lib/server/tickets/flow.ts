import type { createServiceClient } from '@/lib/supabase/service'
import { isTicketedEvent } from '@/lib/server/meeting-url-visibility'
import { fromSofiaLocalInput, toSofiaLocalInput } from '@/lib/format'

type ServiceClient = ReturnType<typeof createServiceClient>

export type TicketFlow = {
  event: { id: string; title: string; start_time: string; end_time: string; cancelled: boolean }
  /** Decided by the products, never by the weekday. */
  kind: 'free' | 'code' | 'closed'
  selling: boolean
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** null: not a ticketed event, so today's guest flow applies. */
export async function getTicketFlow(supabase: ServiceClient, eventId: string): Promise<TicketFlow | null> {
  if (!UUID.test(eventId)) return null
  const { data: event, error } = await supabase
    .from('calendar_events')
    .select('id, title, start_time, end_time, source, series_key, tickets_cancelled_at')
    .eq('id', eventId)
    .maybeSingle()
  if (error) throw error
  if (event === null || !(await isTicketedEvent(supabase, event))) return null

  const { data, error: productsError } = await supabase.from('ticket_products').select('kind, active, event_id, series_key')
  if (productsError) throw productsError
  const products = data.filter((p) => p.event_id === event.id || (p.series_key !== null && p.series_key === event.series_key))
  const paid = products.filter((p) => p.kind !== 'free_registration')
  const selling = paid.some((p) => p.active)
  return {
    event: {
      id: event.id,
      title: event.title,
      start_time: event.start_time,
      end_time: event.end_time,
      cancelled: event.tickets_cancelled_at !== null,
    },
    kind: products.some((p) => p.kind === 'free_registration' && p.active) ? 'free'
      // Passes already sold stay valid after sales stop.
      : paid.length > 0 ? 'code'
      : 'closed',
    selling,
  }
}

/** Online entries can be used from the start of the event's Sofia day until it ends. */
export function onlineWindow(event: { start_time: string; end_time: string }, now = Date.now()): 'before' | 'open' | 'over' {
  if (now >= Date.parse(event.end_time)) return 'over'
  return now < Date.parse(windowOpens(event.start_time)) ? 'before' : 'open'
}

export function windowOpens(startTime: string): string {
  return fromSofiaLocalInput(`${toSofiaLocalInput(startTime).slice(0, 10)}T00:00`)
}
