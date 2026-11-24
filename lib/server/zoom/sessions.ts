import type { createServiceClient } from '@/lib/supabase/service'
import type { Database } from '@/types/supabase'
import { ALL_ROLES } from '@/lib/roles'
import { toSofiaLocalInput } from '@/lib/format'
import { getWebinar, ZoomError } from './client'

type ServiceClient = ReturnType<typeof createServiceClient>
type EventInsert = Database['public']['Tables']['calendar_events']['Insert']

/** A recurring webinar with fixed times; the only kind that has sessions to import. */
const RECURRING_FIXED = 9

export type SeriesConfig = {
  eventRef: string
  seriesKey: string
  eventType: Database['public']['Enums']['event_type']
  inPersonCapacity: number | null
  onlineCapacity: number | null
}

export type ImportResult =
  | { ok: false; code: 'not_recurring' | 'wrong_settings' | 'other_series' }
  | {
      ok: true
      created: number
      updated: number
      /** Future sessions left after the import. */
      future: number
      /** Ours but no longer in Zoom: never deleted, an admin resolves them. */
      vanished: { id: string; title: string; start_time: string }[]
    }

/** ISO week of the Sofia date, as the Google sync computes it. */
export function isoWeek(iso: string): number {
  const d = new Date(`${toSofiaLocalInput(iso).slice(0, 10)}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7))
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  return 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
}

const sameInstant = (a: string, b: string) => Date.parse(a) === Date.parse(b)

/** Idempotent. Never writes to Zoom and never deletes a calendar event. */
export async function importSeries(supabase: ServiceClient, config: SeriesConfig): Promise<ImportResult> {
  const webinar = await getWebinar(config.eventRef)
  if (webinar.type !== RECURRING_FIXED) return { ok: false, code: 'not_recurring' }
  if (webinar.settings.registration_type !== 2 || webinar.settings.approval_type !== 1) {
    return { ok: false, code: 'wrong_settings' }
  }

  const { data: existing, error } = await supabase
    .from('calendar_events')
    .select('id, title, start_time, end_time, series_key, zoom_session_ref, tickets_cancelled_at')
    .eq('zoom_event_ref', config.eventRef)
  if (error) throw error
  if (existing.some((row) => row.series_key !== config.seriesKey)) return { ok: false, code: 'other_series' }

  const now = Date.now()
  const sessions = webinar.occurrences
    .filter((o) => o.status === 'available')
    .map((o) => ({
      ref: o.occurrence_id,
      start: new Date(o.start_time).toISOString(),
      end: new Date(Date.parse(o.start_time) + o.duration * 60_000).toISOString(),
    }))
    .filter((s) => Date.parse(s.end) > now)

  const byRef = new Map(existing.map((row) => [row.zoom_session_ref, row]))
  const inserts: EventInsert[] = []
  let updated = 0
  for (const s of sessions) {
    const row = byRef.get(s.ref)
    if (row === undefined) {
      inserts.push({
        title: webinar.topic,
        start_time: s.start,
        end_time: s.end,
        week_number: isoWeek(s.start),
        source: 'zoom',
        series_key: config.seriesKey,
        zoom_event_ref: config.eventRef,
        zoom_session_ref: s.ref,
        event_type: config.eventType,
        in_person_capacity: config.inPersonCapacity,
        online_capacity: config.onlineCapacity,
        access_roles: [...ALL_ROLES],
        // Ticketed events never use the guest-registration flow.
        allow_guest_registration: false,
      })
    } else if (!sameInstant(row.start_time, s.start) || !sameInstant(row.end_time, s.end)) {
      const { error: updateError } = await supabase
        .from('calendar_events')
        .update({ start_time: s.start, end_time: s.end, week_number: isoWeek(s.start) })
        .eq('id', row.id)
      if (updateError) throw updateError
      updated++
    }
  }
  if (inserts.length > 0) {
    const { error: insertError } = await supabase
      .from('calendar_events')
      .upsert(inserts, { onConflict: 'zoom_event_ref,zoom_session_ref', ignoreDuplicates: true })
    if (insertError) throw insertError
  }

  const live = new Set(sessions.map((s) => s.ref))
  const vanished = existing
    .filter(
      (row) =>
        // Zoom may stop listing a session once it has started.
        Date.parse(row.start_time) > now &&
        row.tickets_cancelled_at === null &&
        (row.zoom_session_ref === null || !live.has(row.zoom_session_ref)),
    )
    .map(({ id, title, start_time }) => ({ id, title, start_time }))

  return {
    ok: true,
    created: inserts.length,
    updated,
    future: sessions.filter((s) => Date.parse(s.start) > now).length,
    vanished,
  }
}

const LOW_SESSIONS = 3

/** Daily job: re-imports every linked series and tells admins what needs a person. */
export async function importAllSeries(supabase: ServiceClient): Promise<{ series: number; problems: number }> {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('zoom_event_ref, series_key, event_type, in_person_capacity, online_capacity')
    .eq('source', 'zoom')
    .not('zoom_event_ref', 'is', null)
    .order('start_time', { ascending: false })
  if (error) throw error

  // The newest row of a series carries its current type and capacities.
  const series = new Map<string, SeriesConfig>()
  for (const row of data) {
    if (row.zoom_event_ref === null || row.series_key === null || series.has(row.zoom_event_ref)) continue
    series.set(row.zoom_event_ref, {
      eventRef: row.zoom_event_ref,
      seriesKey: row.series_key,
      eventType: row.event_type ?? 'hybrid',
      inPersonCapacity: row.in_person_capacity,
      onlineCapacity: row.online_capacity,
    })
  }

  const messages: string[] = []
  for (const config of series.values()) {
    try {
      const result = await importSeries(supabase, config)
      if (!result.ok) messages.push(`${config.seriesKey}: Zoom settings no longer allow tickets (${result.code}).`)
      else {
        if (result.future < LOW_SESSIONS) messages.push(`${config.seriesKey}: only ${result.future} future Zoom sessions left.`)
        if (result.vanished.length > 0) messages.push(`${config.seriesKey}: ${result.vanished.length} session(s) no longer exist in Zoom.`)
      }
    } catch (err) {
      console.error('[zoom] import failed', config.seriesKey, err instanceof Error ? err.name : 'error')
      messages.push(
        `${config.seriesKey}: the Zoom import failed${err instanceof ZoomError ? ` (${err.status})` : ''}.`,
      )
    }
  }

  if (messages.length > 0) {
    const { data: admins, error: adminsError } = await supabase.from('profiles').select('id').eq('role', 'admin')
    if (adminsError) throw adminsError
    const { error: notifyError } = await supabase.from('member_notifications').insert(
      admins.map((a) => ({
        profile_id: a.id,
        type: 'ticket_alert' as const,
        title: 'Zoom sessions need attention',
        message: messages.join(' '),
        action_url: '/admin/calendar',
      })),
    )
    if (notifyError) throw notifyError
  }
  return { series: series.size, problems: messages.length }
}
