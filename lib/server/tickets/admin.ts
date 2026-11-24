import { auth, clerkClient } from '@clerk/nextjs/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerContext } from '@/lib/supabase/guards'
import { createZoomPort } from '@/lib/server/zoom/port'
import type { Database, Json } from '@/types/supabase'
import { ticketErrorCode } from './errors'
import { emailJoinLink } from './link-email'
import { sendPassEmail } from './pass-email'
import { verifiedEmails, withFreshCodes, type TicketPass } from './passes'
import { registerClaimed, registerWithZoom, type TicketAdmission } from './redeem'
import type { ZoomPort } from './zoom-port'

type ServiceClient = ReturnType<typeof createServiceClient>
export type AdminDeps = { supabase: ServiceClient; zoom: ZoomPort; adminId: string }

/** Zoom allows 3 registrations per person per session per day; self-service stops at 2. */
export const ADMIN_ZOOM_ATTEMPTS = 3

/** A refusal staff can act on. */
export class AdminActionError extends Error {
  constructor(readonly code: string, readonly status = 409) {
    super(code)
  }
}

export async function adminCaller() {
  const { userId } = await auth()
  if (!userId) return { response: Response.json({ error: 'Unauthorized' }, { status: 401 }) } as const
  const supabase = createServiceClient()
  const ctx = await getCallerContext(userId, supabase, 'admin')
  if (ctx.guard) return { response: ctx.guard } as const
  const deps: AdminDeps = { supabase, zoom: createZoomPort(supabase), adminId: ctx.profile.id }
  return { response: null, deps } as const
}

type Context = { params: Promise<{ id: string }> }

/** One POST route: admin only, checks id and body, maps refusals. */
export function adminAction<T>(schema: z.ZodType<T>, run: (deps: AdminDeps, id: string, body: T) => Promise<object>) {
  return async (req: Request, { params }: Context): Promise<Response> => {
    const caller = await adminCaller()
    if (caller.response) return caller.response
    const id = z.uuid().safeParse((await params).id)
    const body = schema.safeParse(await req.json().catch(() => ({})))
    if (!id.success || !body.success) {
      return Response.json({ error: 'Invalid request', code: 'invalid_input' }, { status: 400 })
    }
    return respond(() => run(caller.deps, id.data, body.data))
  }
}

export async function respond(run: () => Promise<object>): Promise<Response> {
  try {
    return Response.json(await run())
  } catch (err) {
    if (err instanceof AdminActionError) return Response.json({ error: 'Refused', code: err.code }, { status: err.status })
    const code = ticketErrorCode(err as { code?: string })
    if (code !== null) return Response.json({ error: 'Refused', code }, { status: code === 'not_found' ? 404 : 409 })
    // By name only: messages can carry a person's details.
    console.error('[admin tickets]', err instanceof Error ? err.name : 'error')
    return Response.json({ error: 'Action failed' }, { status: 500 })
  }
}

async function audit(
  { supabase, adminId }: AdminDeps,
  action: string,
  target: { pass_id?: string; admission_id?: string },
  before: Json,
  after: Json,
) {
  const { error } = await supabase.from('ticket_audit').insert({ actor_profile_id: adminId, action, ...target, before, after })
  if (error) throw error
}

// ── Passes ─────────────────────────────────────────────────────────────────

async function activePass(supabase: ServiceClient, id: string): Promise<TicketPass> {
  const { data, error } = await supabase.from('ticket_passes').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (data === null) throw new AdminActionError('not_found', 404)
  if (data.status === 'void') throw new AdminActionError('void')
  return data
}

type PassPatch = Database['public']['Tables']['ticket_passes']['Update']

/** Only while still active, so a pass voided meanwhile stays untouched. */
async function updatePass(supabase: ServiceClient, id: string, patch: PassPatch): Promise<void> {
  const { data, error } = await supabase
    .from('ticket_passes')
    .update(patch)
    .eq('id', id)
    .eq('status', 'active')
    .select('id')
    .maybeSingle()
  if (error) throw error
  if (data === null) throw new AdminActionError('void')
}

const UNSENT = { email_attempts: 0, email_sent_at: null, email_claimed_at: null }

/** The change stands even when the email does not leave; staff are told. */
async function trySend(supabase: ServiceClient, passId: string): Promise<boolean> {
  try {
    return await sendPassEmail(supabase, passId)
  } catch (err) {
    console.error('[admin tickets] email failed', passId, err instanceof Error ? err.name : 'error')
    return false
  }
}

export async function resendPass(deps: AdminDeps, id: string) {
  const pass = await activePass(deps.supabase, id)
  // A walk-in may have no email.
  if (pass.holder_email === '') throw new AdminActionError('no_email')
  await updatePass(deps.supabase, id, UNSENT)
  await audit(
    deps,
    'resend_email',
    { pass_id: id },
    { email_attempts: pass.email_attempts, email_sent_at: pass.email_sent_at },
    { email_attempts: 0, email_sent_at: null },
  )
  return { emailed: await trySend(deps.supabase, id) }
}

export async function correctPassEmail(deps: AdminDeps, id: string, email: string) {
  const pass = await activePass(deps.supabase, id)
  const keep = pass.holder_profile_id !== null && (await ownsEmail(deps.supabase, pass.holder_profile_id, email))
  const profileId = keep ? pass.holder_profile_id : null
  await updatePass(deps.supabase, id, { ...UNSENT, holder_email: email, holder_profile_id: profileId })
  await audit(
    deps,
    'correct_email',
    { pass_id: id },
    { holder_email: pass.holder_email, holder_profile_id: pass.holder_profile_id },
    { holder_email: email, holder_profile_id: profileId },
  )
  return { emailed: await trySend(deps.supabase, id) }
}

async function ownsEmail(supabase: ServiceClient, profileId: string, email: string): Promise<boolean> {
  const { data, error } = await supabase.from('profiles').select('clerk_id').eq('id', profileId).maybeSingle()
  if (error) throw error
  if (!data?.clerk_id) return false
  const clerk = await clerkClient()
  return verifiedEmails(await clerk.users.getUser(data.clerk_id)).includes(email.toLowerCase())
}

export async function extendPass(deps: AdminDeps, id: string, expiresAt: string) {
  const pass = await activePass(deps.supabase, id)
  if (Date.parse(expiresAt) <= Date.parse(pass.expires_at)) throw new AdminActionError('not_later', 400)
  await updatePass(deps.supabase, id, { expires_at: expiresAt })
  await audit(deps, 'extend_expiry', { pass_id: id }, { expires_at: pass.expires_at }, { expires_at: expiresAt })
  return {}
}

/** Codes are passwords, so the audit keeps only their last two characters. */
const masked = (code: string) => `******${code.slice(-2)}`

export async function reissuePass(deps: AdminDeps, id: string) {
  const pass = await activePass(deps.supabase, id)
  const { data, error } = await withFreshCodes<TicketPass>(({ unlockCode, qrToken }) =>
    deps.supabase
      .from('ticket_passes')
      .update({ ...UNSENT, unlock_code: unlockCode, qr_token: qrToken })
      .eq('id', id)
      .eq('status', 'active')
      .select()
      .maybeSingle(),
  )
  if (error) throw error
  if (data === null) throw new AdminActionError('void')
  await audit(
    deps,
    'reissue_code',
    { pass_id: id },
    { unlock_code: masked(pass.unlock_code) },
    { unlock_code: masked(data.unlock_code) },
  )
  return { emailed: data.holder_email !== '' && (await trySend(deps.supabase, id)) }
}

export async function voidPass(deps: AdminDeps, id: string, reason: string) {
  await activePass(deps.supabase, id)
  await updatePass(deps.supabase, id, { status: 'void', void_reason: reason })
  await audit(deps, 'void_pass', { pass_id: id }, { status: 'active' }, { status: 'void', void_reason: reason })
  return {}
}

// ── Admissions ─────────────────────────────────────────────────────────────

async function admissionById(supabase: ServiceClient, id: string): Promise<TicketAdmission> {
  const { data, error } = await supabase.from('ticket_admissions').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (data === null) throw new AdminActionError('not_found', 404)
  return data
}

/**
 * A revoked row that still has `zoom_ref` is still registered in Zoom: that is
 * what the retry button works on. Returns false when Zoom refused.
 */
async function cancelInZoom(
  { supabase, zoom }: AdminDeps,
  row: Pick<TicketAdmission, 'id' | 'event_id' | 'zoom_ref'>,
): Promise<boolean> {
  if (row.zoom_ref === null) return true
  try {
    await zoom.cancel({ eventId: row.event_id, ref: row.zoom_ref })
  } catch (err) {
    console.error('[admin tickets] Zoom cancel failed', row.id, err instanceof Error ? err.name : 'error')
    return false
  }
  const { error } = await supabase
    .from('ticket_admissions')
    .update({ zoom_ref: null })
    .eq('id', row.id)
    .eq('zoom_ref', row.zoom_ref)
  if (error) throw error
  return true
}

const CANCEL_BATCH = 5

/** How many are still registered in Zoom. The portal's own link dies in any case. */
async function cancelAllInZoom(deps: AdminDeps, rows: TicketAdmission[]): Promise<number> {
  const online = rows.filter((r) => r.mode === 'online')
  if (online.length > 0) {
    const { error } = await deps.supabase
      .from('ticket_admissions')
      .update({ zoom_join_link: null, device_token_hash: null })
      .in('id', online.map((r) => r.id))
    if (error) throw error
  }
  let failed = 0
  for (let i = 0; i < online.length; i += CANCEL_BATCH) {
    const done = await Promise.all(online.slice(i, i + CANCEL_BATCH).map((r) => cancelInZoom(deps, r)))
    failed += done.filter((ok) => !ok).length
  }
  return failed
}

export async function revokeAdmission(deps: AdminDeps, id: string) {
  const row = await admissionById(deps.supabase, id)
  const { data, error } = await deps.supabase
    .from('ticket_admissions')
    .update({ status: 'revoked', zoom_join_link: null, device_token_hash: null })
    .eq('id', id)
    .in('status', ['pending_zoom', 'active'])
    .select()
    .maybeSingle()
  if (error) throw error
  if (data === null) throw new AdminActionError('revoked')
  await audit(deps, 'revoke_admission', { admission_id: id }, { status: row.status }, { status: 'revoked' })
  return { zoomCancelled: await cancelInZoom(deps, data), online: data.mode === 'online' }
}

export async function retryZoomCancel(deps: AdminDeps, id: string) {
  const row = await admissionById(deps.supabase, id)
  if (row.status !== 'revoked' || row.zoom_ref === null) throw new AdminActionError('nothing_to_cancel')
  const ok = await cancelInZoom(deps, row)
  await audit(deps, 'retry_zoom_cancel', { admission_id: id }, { registered_in_zoom: true }, { registered_in_zoom: !ok })
  if (!ok) throw new AdminActionError('zoom_failed', 502)
  return {}
}

/** Same row, so no extra entry. The old device loses the link with the old name. */
export async function renameAdmission(deps: AdminDeps, id: string, name: string) {
  const { supabase } = deps
  const row = await admissionById(supabase, id)
  if (row.mode !== 'online' || row.status === 'revoked') throw new AdminActionError('not_online')
  if (row.zoom_attempts >= ADMIN_ZOOM_ATTEMPTS) throw new AdminActionError('attempts_used')
  const { data: event, error: eventError } = await supabase
    .from('calendar_events')
    .select('start_time')
    .eq('id', row.event_id)
    .maybeSingle()
  if (eventError) throw eventError
  if (event === null || Date.now() >= Date.parse(event.start_time)) throw new AdminActionError('started')

  // Takes the attempt and the row in one step: healing and Join cannot interleave.
  const { data: claimed, error } = await supabase
    .from('ticket_admissions')
    .update({
      attendee_name: name,
      status: 'pending_zoom',
      zoom_join_link: null,
      zoom_attempts: row.zoom_attempts + 1,
      zoom_attempted_at: new Date().toISOString(),
      device_token_hash: null,
      device_claimed_at: null,
    })
    .eq('id', id)
    .eq('status', row.status)
    .eq('zoom_attempts', row.zoom_attempts)
    .select()
    .maybeSingle()
  if (error) throw error
  if (claimed === null) throw new AdminActionError('busy')

  if (!(await cancelInZoom(deps, claimed))) {
    const { error: undoError } = await supabase
      .from('ticket_admissions')
      .update({
        attendee_name: row.attendee_name,
        status: row.status,
        zoom_join_link: row.zoom_join_link,
        zoom_attempts: row.zoom_attempts,
        zoom_attempted_at: row.zoom_attempted_at,
        device_token_hash: row.device_token_hash,
        device_claimed_at: row.device_claimed_at,
      })
      .eq('id', id)
      .eq('status', 'pending_zoom')
      .eq('zoom_attempts', claimed.zoom_attempts)
    if (undoError) throw undoError
    throw new AdminActionError('zoom_failed', 502)
  }

  await audit(deps, 'rename_admission', { admission_id: id }, { attendee_name: row.attendee_name }, { attendee_name: name })
  const active = await registerClaimed(deps, claimed)
  if (active !== null) await emailJoinLink(active)
  return { registered: active !== null }
}

export async function retryAdmission(deps: AdminDeps, id: string) {
  const row = await admissionById(deps.supabase, id)
  if (row.status !== 'pending_zoom') throw new AdminActionError('not_pending')
  if (row.zoom_attempts >= ADMIN_ZOOM_ATTEMPTS) throw new AdminActionError('attempts_used')
  const active = await registerWithZoom(deps, row, ADMIN_ZOOM_ATTEMPTS)
  const now = await admissionById(deps.supabase, id)
  // Nothing was claimed: another attempt is running.
  if (active === null && now.zoom_attempts === row.zoom_attempts) throw new AdminActionError('busy')
  await audit(
    deps,
    'retry_admission',
    { admission_id: id },
    { status: row.status, zoom_attempts: row.zoom_attempts },
    { status: now.status, zoom_attempts: now.zoom_attempts },
  )
  if (active !== null) await emailJoinLink(active)
  return { registered: active !== null }
}

// ── Session and person ─────────────────────────────────────────────────────

async function sessionById(supabase: ServiceClient, id: string) {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('id, start_time, end_time, series_key, tickets_cancelled_at')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (data === null) throw new AdminActionError('not_found', 404)
  return data
}

/** What the confirmation shows. Same rule as `cancel_ticketed_session`. */
export async function cancelPreview(deps: AdminDeps, id: string) {
  const event = await sessionById(deps.supabase, id)
  const { count: admissions, error } = await deps.supabase
    .from('ticket_admissions')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', id)
    .in('status', ['pending_zoom', 'active'])
  if (error) throw error
  let passes = 0
  if (event.series_key !== null) {
    const { count, error: passError } = await deps.supabase
      .from('ticket_passes')
      .select('id, ticket_products!inner(series_key, validity_days)', { count: 'exact', head: true })
      .eq('ticket_products.series_key', event.series_key)
      .not('ticket_products.validity_days', 'is', null)
      .eq('status', 'active')
      .gt('expires_at', event.start_time)
      .lt('created_at', event.end_time)
    if (passError) throw passError
    passes = count ?? 0
  }
  return { passes, admissions: admissions ?? 0 }
}

export async function cancelSession(deps: AdminDeps, id: string) {
  const event = await sessionById(deps.supabase, id)
  if (event.tickets_cancelled_at !== null) throw new AdminActionError('cancelled')
  const { data, error } = await deps.supabase.rpc('cancel_ticketed_session', { p_event_id: id, p_actor: deps.adminId })
  if (error) throw error
  await audit(
    deps,
    'cancel_session',
    {},
    { event_id: id, cancelled: false },
    { event_id: id, cancelled: true, revoked: data.length },
  )
  return { zoomFailed: await cancelAllInZoom(deps, data) }
}

/** The SQL function writes its own audit rows, without personal data. */
export async function anonymisePerson(deps: AdminDeps, email: string) {
  const { data, error } = await deps.supabase.rpc('anonymise_ticket_holder', { p_email: email, p_actor: deps.adminId })
  if (error) throw error
  return { zoomFailed: await cancelAllInZoom(deps, data) }
}
