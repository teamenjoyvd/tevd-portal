import type { createServiceClient } from '@/lib/supabase/service'
import type { Database } from '@/types/supabase'

type ServiceClient = ReturnType<typeof createServiceClient>
export type TicketProductRow = Database['public']['Tables']['ticket_products']['Row']

const EVENT_COLUMNS = 'id, title, start_time, end_time, source, series_key, in_person_capacity, tickets_cancelled_at' as const
/** Sales end 30 minutes after the official end. */
export const SALES_GRACE_MS = 30 * 60_000

export type SaleEvent = Pick<
  Database['public']['Tables']['calendar_events']['Row'],
  'id' | 'title' | 'start_time' | 'end_time' | 'source' | 'series_key' | 'in_person_capacity' | 'tickets_cancelled_at'
>
export type Sale = { event: SaleEvent; products: TicketProductRow[]; salesOpen: boolean; onlineOver: boolean }

/**
 * The event and what is sold for it, or null when it is not a ticketed event.
 * `source` alone does not make an event ticketed: ordinary admin-created events
 * are 'portal' too, so a portal event also needs a product.
 */
export async function getSale(supabase: ServiceClient, eventId: string, now = Date.now()): Promise<Sale | null> {
  const { data: event, error } = await supabase.from('calendar_events').select(EVENT_COLUMNS).eq('id', eventId).maybeSingle()
  if (error) throw error
  if (event === null || (event.source !== 'zoom' && event.source !== 'portal')) return null

  const { data: rows, error: productsError } = await supabase
    .from('ticket_products')
    .select('*')
    .eq('active', true)
    .in('kind', ['single', 'pack'])
    .order('price_cents')
  if (productsError) throw productsError
  const products = rows.filter(
    (p) => p.event_id === event.id || (p.series_key !== null && p.series_key === event.series_key),
  )
  if (event.source !== 'zoom' && products.length === 0) return null

  const end = Date.parse(event.end_time)
  return {
    event,
    products,
    salesOpen: products.length > 0 && event.tickets_cancelled_at === null && now < end + SALES_GRACE_MS,
    onlineOver: now >= end,
  }
}

const sofiaDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Sofia' })

/** A door purchase uses one entry tonight, so the event must be on the same Sofia day. */
export function isDoorOpen(event: SaleEvent, now = Date.now()): boolean {
  return sofiaDay.format(now) === sofiaDay.format(new Date(event.start_time))
}

export async function isRoomFull(supabase: ServiceClient, event: SaleEvent): Promise<boolean> {
  if (event.in_person_capacity === null) return false
  const { count, error } = await supabase
    .from('ticket_admissions')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', event.id)
    .eq('mode', 'in_person')
    .in('status', ['pending_zoom', 'active'])
  if (error) throw error
  return (count ?? 0) >= event.in_person_capacity
}
