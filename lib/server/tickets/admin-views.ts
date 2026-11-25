import type { createServiceClient } from '@/lib/supabase/service'
import { normalizeUnlockCode } from './codes'
import { MAX_EMAIL_ATTEMPTS } from './pass-email'
import { MAX_ZOOM_ATTEMPTS } from './redeem'

type ServiceClient = ReturnType<typeof createServiceClient>
const LIMIT = 50
const DAY_MS = 86_400_000
const USED = ['pending_zoom', 'active']

// `qr_token`, join links and device hashes are never selected: staff need none of them.
const PASS_COLUMNS =
  'id, order_id, holder_name, holder_email, entries_total, expires_at, unlock_code, status, void_reason, email_sent_at, email_attempts, created_at, ticket_products(kind, series_key, calendar_events(title)), ticket_admissions(status)' as const
const ADMISSION_COLUMNS =
  'id, attendee_name, attendee_email, mode, status, admitted_via, zoom_attempts, zoom_ref, checked_in_at, created_at, calendar_events!inner(title, start_time)' as const

const like = (text: string) => `%${text.replace(/[\\%_]/g, '\\$&')}%`

/** Newest first, without repeats. */
function merge<T extends { id: string; created_at: string }>(results: { data: T[] | null; error: unknown }[]): T[] {
  const found = new Map<string, T>()
  for (const { data, error } of results) {
    if (error) throw error
    for (const row of data ?? []) found.set(row.id, row)
  }
  return [...found.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, LIMIT)
}

function passQuery(supabase: ServiceClient) {
  return supabase.from('ticket_passes').select(PASS_COLUMNS).order('created_at', { ascending: false }).limit(LIMIT)
}
type PassRow = NonNullable<Awaited<ReturnType<typeof passQuery>>['data']>[number]

function toPass({ ticket_products: product, ticket_admissions: admissions, ...pass }: PassRow) {
  return {
    ...pass,
    kind: product?.kind ?? '',
    eventTitle: product?.calendar_events?.title ?? null,
    seriesKey: product?.series_key ?? null,
    used: admissions.filter((a) => USED.includes(a.status)).length,
  }
}
export type AdminPass = ReturnType<typeof toPass>

/** The latest, or those whose holder, email or exact code matches. */
export async function listPasses(supabase: ServiceClient, q: string): Promise<AdminPass[]> {
  const text = q.trim()
  // Separate queries: .or() would parse commas and brackets typed by staff.
  const results = await Promise.all(
    text === ''
      ? [passQuery(supabase)]
      : [
          passQuery(supabase).ilike('holder_name', like(text)),
          passQuery(supabase).ilike('holder_email', like(text)),
          passQuery(supabase).eq('unlock_code', normalizeUnlockCode(text)),
        ],
  )
  return merge<PassRow>(results).map(toPass)
}

function orderQuery(supabase: ServiceClient) {
  return supabase
    .from('ticket_orders')
    .select('id, buyer_name, buyer_email, status, total_cents, currency, created_at, door_event_id, ticket_products(kind)')
    .order('created_at', { ascending: false })
    .limit(LIMIT)
}
export type AdminOrder = NonNullable<Awaited<ReturnType<typeof orderQuery>>['data']>[number]

export async function listOrders(supabase: ServiceClient, q: string): Promise<AdminOrder[]> {
  const text = q.trim()
  const results = await Promise.all(
    text === ''
      ? [orderQuery(supabase)]
      : [orderQuery(supabase).ilike('buyer_name', like(text)), orderQuery(supabase).ilike('buyer_email', like(text))],
  )
  return merge<AdminOrder>(results)
}

export type AdminSession = { id: string; title: string; start_time: string; cancelled: boolean }

/** Ticketed sessions from the last 30 days and the next 60. A portal event is ticketed when a product covers it. */
export async function listSessions(supabase: ServiceClient): Promise<AdminSession[]> {
  const [events, products] = await Promise.all([
    supabase
      .from('calendar_events')
      .select('id, title, start_time, source, series_key, tickets_cancelled_at')
      .in('source', ['zoom', 'portal'])
      .gt('start_time', new Date(Date.now() - 30 * DAY_MS).toISOString())
      .lt('start_time', new Date(Date.now() + 60 * DAY_MS).toISOString())
      .order('start_time'),
    supabase.from('ticket_products').select('event_id, series_key'),
  ])
  if (events.error) throw events.error
  if (products.error) throw products.error
  return events.data
    .filter(
      (e) =>
        e.source === 'zoom' ||
        products.data.some((p) => p.event_id === e.id || (p.series_key !== null && p.series_key === e.series_key)),
    )
    .map((e) => ({ id: e.id, title: e.title, start_time: e.start_time, cancelled: e.tickets_cancelled_at !== null }))
}

function admissionQuery(supabase: ServiceClient) {
  return supabase.from('ticket_admissions').select(ADMISSION_COLUMNS).order('created_at', { ascending: false })
}
type AdmissionRow = NonNullable<Awaited<ReturnType<typeof admissionQuery>>['data']>[number]

function toAdmission({ zoom_ref, calendar_events: event, ...admission }: AdmissionRow) {
  return {
    ...admission,
    eventTitle: event.title,
    eventStart: event.start_time,
    /** Revoked here, still registered in Zoom. */
    zoomCancelFailed: admission.status === 'revoked' && zoom_ref !== null,
  }
}
export type AdminAdmission = ReturnType<typeof toAdmission>
export type AdminAdmissions = {
  online: number
  inPerson: number
  onlineCapacity: number | null
  inPersonCapacity: number | null
  admissions: AdminAdmission[]
}

export async function listAdmissions(supabase: ServiceClient, eventId: string): Promise<AdminAdmissions> {
  const [event, rows] = await Promise.all([
    supabase.from('calendar_events').select('online_capacity, in_person_capacity').eq('id', eventId).maybeSingle(),
    admissionQuery(supabase).eq('event_id', eventId),
  ])
  if (event.error) throw event.error
  if (rows.error) throw rows.error
  const used = (mode: string) => rows.data.filter((r) => r.mode === mode && USED.includes(r.status)).length
  return {
    online: used('online'),
    inPerson: used('in_person'),
    onlineCapacity: event.data?.online_capacity ?? null,
    inPersonCapacity: event.data?.in_person_capacity ?? null,
    admissions: rows.data.map(toAdmission),
  }
}

export type AdminAttention = { stuck: AdminAdmission[]; stillInZoom: AdminAdmission[]; failedEmails: AdminPass[] }

/** What needs a person: links that failed twice, Zoom cancels that failed, emails that never left. */
export async function listAttention(supabase: ServiceClient): Promise<AdminAttention> {
  const now = new Date().toISOString()
  const open = () => admissionQuery(supabase).gt('calendar_events.end_time', now).limit(LIMIT)
  const [stuck, inZoom, emails] = await Promise.all([
    open().eq('status', 'pending_zoom').gte('zoom_attempts', MAX_ZOOM_ATTEMPTS),
    open().eq('status', 'revoked').not('zoom_ref', 'is', null),
    passQuery(supabase).eq('status', 'active').is('email_sent_at', null).gte('email_attempts', MAX_EMAIL_ATTEMPTS),
  ])
  if (stuck.error) throw stuck.error
  if (inZoom.error) throw inZoom.error
  if (emails.error) throw emails.error
  return { stuck: stuck.data.map(toAdmission), stillInZoom: inZoom.data.map(toAdmission), failedEmails: emails.data.map(toPass) }
}
