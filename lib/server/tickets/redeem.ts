import type { createServiceClient } from '@/lib/supabase/service'
import type { Database } from '@/types/supabase'
import { fromSofiaLocalInput, todayInSofia, toSofiaLocalInput } from '@/lib/format'
import { alertAdmins } from './alerts'
import { ticketErrorCode, type TicketErrorCode } from './errors'
import type { ZoomPort, ZoomRegistration } from './zoom-port'

type ServiceClient = ReturnType<typeof createServiceClient>
export type TicketAdmission = Database['public']['Tables']['ticket_admissions']['Row']

/**
 * Zoom allows 3 registrations per person per session per day (ADR-017). Two are
 * spent here; the third is kept for an admin fix.
 */
export const MAX_ZOOM_ATTEMPTS = 2
const CLAIM_HOLD_MS = 30_000

type Deps = { supabase: ServiceClient; zoom: ZoomPort }

export type RedeemInput = {
  passId: string
  eventId: string
  attendees: { name: string; email?: string }[]
  mode: 'online' | 'in_person'
  admittedVia: 'code' | 'qr' | 'search' | 'admin'
  actorId: string | null
}

export type RedeemResult =
  | { ok: true; admissions: TicketAdmission[] }
  | { ok: false; code: TicketErrorCode }

/** Errors are logged by name: a Zoom message can carry the attendee's details. */
function logFailure(what: string, admissionId: string, err: unknown) {
  console.error(`[tickets] ${what}`, admissionId, err instanceof Error ? err.name : 'error')
}

/**
 * Uses entries, then registers online people with Zoom. Once the entries are
 * used nothing after it can fail the redemption: the row stays `pending_zoom`,
 * uses no further entry, and healing finishes it.
 */
export async function redeem(deps: Deps, input: RedeemInput): Promise<RedeemResult> {
  const { data, error } = await deps.supabase.rpc('redeem_pass_entries', {
    p_pass_id: input.passId,
    p_event_id: input.eventId,
    p_attendees: input.attendees,
    p_mode: input.mode,
    p_admitted_via: input.admittedVia,
    // Generated types drop SQL nullability; NULL is valid for a self-service redemption.
    p_actor: input.actorId as string,
  })
  if (error) {
    const code = ticketErrorCode(error)
    if (code === null) throw error
    return { ok: false, code }
  }

  const admissions: TicketAdmission[] = []
  for (const row of data) {
    admissions.push(row.mode === 'online' ? ((await tryRegister(deps, row)) ?? row) : row)
  }
  return { ok: true, admissions }
}

async function tryRegister(deps: Deps, row: TicketAdmission): Promise<TicketAdmission | null> {
  try {
    return await registerWithZoom(deps, row)
  } catch (err) {
    logFailure('admission left pending', row.id, err)
    return null
  }
}

/**
 * Claims one attempt. `zoom_attempts` is the compare-and-swap value: every claim
 * increments it, so two callers holding the same row cannot both win.
 */
async function claim(supabase: ServiceClient, row: TicketAdmission, maxAttempts: number): Promise<TicketAdmission | null> {
  if (row.status !== 'pending_zoom' || row.zoom_attempts >= maxAttempts) return null
  const now = Date.now()
  if (row.zoom_attempted_at !== null && Date.parse(row.zoom_attempted_at) > now - CLAIM_HOLD_MS) return null
  const { data, error } = await supabase
    .from('ticket_admissions')
    .update({ zoom_attempted_at: new Date(now).toISOString(), zoom_attempts: row.zoom_attempts + 1 })
    .eq('id', row.id)
    .eq('status', 'pending_zoom')
    .eq('zoom_attempts', row.zoom_attempts)
    .select()
    .maybeSingle()
  if (error) throw error
  return data
}

/** Returns the active row, or null when it was not claimed, Zoom failed, or it was revoked meanwhile. */
export async function registerWithZoom(
  deps: Deps,
  row: TicketAdmission,
  maxAttempts = MAX_ZOOM_ATTEMPTS,
): Promise<TicketAdmission | null> {
  const claimed = await claim(deps.supabase, row, maxAttempts)
  return claimed === null ? null : registerClaimed(deps, claimed)
}

/** The caller has already taken the attempt. */
export async function registerClaimed({ supabase, zoom }: Deps, claimed: TicketAdmission): Promise<TicketAdmission | null> {
  let registration: ZoomRegistration
  try {
    registration = await zoom.register({
      eventId: claimed.event_id,
      admissionId: claimed.id,
      name: claimed.attendee_name,
      // CHECK on the table: an online row always has an email.
      email: claimed.attendee_email as string,
    })
  } catch (err) {
    logFailure('Zoom registration failed', claimed.id, err)
    if (claimed.zoom_attempts >= MAX_ZOOM_ATTEMPTS) {
      await alertAdmins(supabase, 'A Zoom registration failed twice. The attendee has no link yet.')
    }
    return null
  }

  const { data, error } = await supabase
    .from('ticket_admissions')
    .update({ status: 'active', zoom_ref: registration.ref, zoom_join_link: registration.joinLink })
    .eq('id', claimed.id)
    .eq('status', 'pending_zoom')
    .select()
    .maybeSingle()
  if (error) throw error
  if (data === null) {
    // Revoked while Zoom was answering: the link must not outlive the admission.
    try {
      await zoom.cancel({ eventId: claimed.event_id, ref: registration.ref })
    } catch (err) {
      logFailure('Zoom cancel failed', claimed.id, err)
      await alertAdmins(supabase, 'A revoked admission is still registered in Zoom. Remove it there.')
    }
  }
  return data
}

/**
 * Finishes `pending_zoom` rows of today's events (Sofia day), optionally of one
 * pass. `onActive` tells the attendee; one row failing does not stop the others.
 */
export async function healPendingAdmissions(
  deps: Deps & { onActive: (row: TicketAdmission) => Promise<void> },
  filter: { passId?: string } = {},
): Promise<{ healed: number }> {
  const dayStart = fromSofiaLocalInput(`${todayInSofia()}T00:00`)
  // Noon is never near a clock change, so noon + 24h is always on the next date.
  const noon = fromSofiaLocalInput(`${todayInSofia()}T12:00`)
  const tomorrow = new Date(Date.parse(noon) + 86_400_000).toISOString()
  const dayEnd = fromSofiaLocalInput(`${sofiaDate(tomorrow)}T00:00`)

  const { data: events, error: eventsError } = await deps.supabase
    .from('calendar_events')
    .select('id')
    .gte('start_time', dayStart)
    .lt('start_time', dayEnd)
  if (eventsError) throw eventsError
  if (events.length === 0) return { healed: 0 }

  let query = deps.supabase
    .from('ticket_admissions')
    .select('*')
    .eq('status', 'pending_zoom')
    .lt('zoom_attempts', MAX_ZOOM_ATTEMPTS)
    // Someone who attended and left comes back only by pressing Join (release.ts).
    .is('attended_online_at', null)
    .in('event_id', events.map((e) => e.id))
  if (filter.passId !== undefined) query = query.eq('pass_id', filter.passId)
  const { data: rows, error } = await query
  if (error) throw error

  let healed = 0
  for (const row of rows) {
    const active = await tryRegister(deps, row)
    if (active === null) continue
    healed++
    try {
      await deps.onActive(active)
    } catch (err) {
      logFailure('onActive failed', active.id, err)
    }
  }
  return { healed }
}

const sofiaDate = (iso: string) => toSofiaLocalInput(iso).slice(0, 10)
