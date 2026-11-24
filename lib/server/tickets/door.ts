import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerContext } from '@/lib/supabase/guards'
import { todayInSofia, toSofiaLocalInput } from '@/lib/format'
import { getTicketFlow, type TicketFlow } from './flow'
import type { TicketPass } from './passes'
import { SALES_GRACE_MS } from './sales'

type ServiceClient = ReturnType<typeof createServiceClient>
const USED = ['pending_zoom', 'active']

export type DoorEvent = { id: string; title: string; start_time: string; end_time: string; free: boolean; selling: boolean }
export type DoorEntry = { name: string; mode: string; at: string; staff: string | null }
export type DoorPass = {
  color: 'green' | 'amber' | 'red'
  /** Set when red. */
  reason: 'void' | 'expired' | 'not_covered' | 'no_entries' | 'cancelled' | 'outside_window' | null
  passId: string
  holder: string
  entriesLeft: number
  entriesTotal: number
  expiresAt: string
  admitted: DoorEntry[]
}

/** Admin or core, or the response to return. */
export async function doorStaff() {
  const { userId } = await auth()
  if (!userId) return { response: Response.json({ error: 'Unauthorized' }, { status: 401 }) } as const
  const supabase = createServiceClient()
  const ctx = await getCallerContext(userId, supabase, 'adminOrCore')
  if (ctx.guard) return { response: ctx.guard } as const
  return { response: null, supabase, staffId: ctx.profile.id } as const
}

/** Check-in runs from the start of the event's Sofia day until 30 minutes after its end. */
export function doorIsOpen(event: { start_time: string; end_time: string }, now = Date.now()): boolean {
  return now < Date.parse(event.end_time) + SALES_GRACE_MS && toSofiaLocalInput(event.start_time).slice(0, 10) <= todayInSofia()
}

export async function todaysDoorEvents(supabase: ServiceClient): Promise<DoorEvent[]> {
  const now = Date.now()
  const { data, error } = await supabase
    .from('calendar_events')
    .select('id, start_time, end_time')
    .in('source', ['zoom', 'portal'])
    .gt('end_time', new Date(now - SALES_GRACE_MS).toISOString())
    .lt('start_time', new Date(now + 86_400_000).toISOString())
    .order('start_time')
  if (error) throw error
  const flows = await Promise.all(data.filter((e) => doorIsOpen(e, now)).map((e) => getTicketFlow(supabase, e.id)))
  return flows
    .filter((f): f is TicketFlow => f !== null && !f.event.cancelled && f.kind !== 'closed')
    .map((f) => ({
      id: f.event.id,
      title: f.event.title,
      start_time: f.event.start_time,
      end_time: f.event.end_time,
      free: f.kind === 'free',
      selling: f.selling,
    }))
}

async function toEntries(
  supabase: ServiceClient,
  rows: { attendee_name: string; mode: string; created_at: string; checked_in_at: string | null; checked_in_by: string | null }[],
): Promise<DoorEntry[]> {
  const ids = [...new Set(rows.map((r) => r.checked_in_by).filter((id) => id !== null))]
  const names = new Map<string, string>()
  if (ids.length > 0) {
    const { data, error } = await supabase.from('profiles').select('id, first_name, last_name').in('id', ids)
    if (error) throw error
    for (const p of data) names.set(p.id, `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim())
  }
  return rows.map((r) => ({
    name: r.attendee_name,
    mode: r.mode,
    at: r.checked_in_at ?? r.created_at,
    staff: r.checked_in_by === null ? null : names.get(r.checked_in_by) ?? null,
  }))
}

const ENTRY_COLUMNS = 'event_id, attendee_name, mode, created_at, checked_in_at, checked_in_by' as const

/** Who is in the room. Newest first. */
export async function doorList(supabase: ServiceClient, eventId: string): Promise<DoorEntry[]> {
  const { data, error } = await supabase
    .from('ticket_admissions')
    .select(ENTRY_COLUMNS)
    .eq('event_id', eventId)
    .eq('mode', 'in_person')
    .in('status', USED)
    .order('created_at', { ascending: false })
  if (error) throw error
  return toEntries(supabase, data)
}

async function coveringProducts(supabase: ServiceClient, event: { id: string; series_key: string | null }): Promise<string[]> {
  const { data, error } = await supabase.from('ticket_products').select('id, event_id, series_key')
  if (error) throw error
  return data
    .filter((p) => p.event_id === event.id || (p.series_key !== null && p.series_key === event.series_key))
    .map((p) => p.id)
}

async function loadEvent(supabase: ServiceClient, eventId: string) {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('id, start_time, end_time, series_key, tickets_cancelled_at')
    .eq('id', eventId)
    .maybeSingle()
  if (error) throw error
  return data
}

/** What to show for a pass. Advice only: `redeem_pass_entries` decides. Null when the event does not exist. */
export async function describePass(supabase: ServiceClient, eventId: string, pass: TicketPass): Promise<DoorPass | null> {
  const event = await loadEvent(supabase, eventId)
  if (event === null) return null
  const [products, admissions] = await Promise.all([
    coveringProducts(supabase, event),
    supabase.from('ticket_admissions').select(ENTRY_COLUMNS).eq('pass_id', pass.id).in('status', USED).order('created_at'),
  ])
  if (admissions.error) throw admissions.error
  const here = admissions.data.filter((r) => r.event_id === eventId)
  const entriesLeft = pass.entries_total - admissions.data.length
  const expires = Date.parse(pass.expires_at)

  const reason: DoorPass['reason'] =
    pass.status === 'void' ? 'void'
    : event.tickets_cancelled_at !== null ? 'cancelled'
    : !products.includes(pass.product_id) ? 'not_covered'
    : Date.now() >= expires || Date.parse(event.start_time) >= expires ? 'expired'
    : !doorIsOpen(event) ? 'outside_window'
    : entriesLeft <= 0 && here.length === 0 ? 'no_entries'
    : null
  return {
    color: reason !== null ? 'red' : entriesLeft > 0 ? 'green' : 'amber',
    reason,
    passId: pass.id,
    holder: pass.holder_name,
    entriesLeft,
    entriesTotal: pass.entries_total,
    expiresAt: pass.expires_at,
    admitted: await toEntries(supabase, here),
  }
}

export type DoorMatch = { passId: string; holder: string; email: string }
export const MAX_MATCHES = 20

/** Passes valid for this event whose holder's name or email contains the text. */
export async function searchPasses(supabase: ServiceClient, eventId: string, text: string): Promise<DoorMatch[]> {
  const event = await loadEvent(supabase, eventId)
  if (event === null) return []
  const products = await coveringProducts(supabase, event)
  const after = new Date(Math.max(Date.now(), Date.parse(event.start_time))).toISOString()
  const pattern = `%${text.replace(/[\\%_]/g, '\\$&')}%`
  // Two queries: .or() would parse commas and brackets typed by staff.
  const find = (column: 'holder_name' | 'holder_email') =>
    supabase
      .from('ticket_passes')
      .select('id, holder_name, holder_email')
      .eq('status', 'active')
      .in('product_id', products)
      .gt('expires_at', after)
      .ilike(column, pattern)
      .order('holder_name')
      .limit(MAX_MATCHES)
  const found = new Map<string, DoorMatch>()
  for (const { data, error } of await Promise.all([find('holder_name'), find('holder_email')])) {
    if (error) throw error
    for (const p of data) found.set(p.id, { passId: p.id, holder: p.holder_name, email: p.holder_email })
  }
  return [...found.values()].slice(0, MAX_MATCHES)
}
