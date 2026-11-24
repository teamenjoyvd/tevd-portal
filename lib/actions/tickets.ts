'use server'

import { after } from 'next/server'
import { cookies, headers } from 'next/headers'
import { auth, currentUser } from '@clerk/nextjs/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { consumeCodeAttempt, consumeDeviceCodeAttempt, consumeRegistrationSlot } from '@/lib/rate-limit'
import { createZoomPort } from '@/lib/server/zoom/port'
import { ticketErrorCode } from '@/lib/server/tickets/errors'
import { claimFirstDevice, createDeviceCode, holdsDevice, moveDevice } from '@/lib/server/tickets/device'
import { deviceCookieName } from '@/lib/server/tickets/held'
import { getTicketFlow, onlineWindow } from '@/lib/server/tickets/flow'
import { emailJoinLink, mayEmail, sendDeviceCodeEmail } from '@/lib/server/tickets/link-email'
import { findPass, verifiedEmails, withFreshCodes, type TicketPass } from '@/lib/server/tickets/passes'
import { sendPassCopy } from '@/lib/server/tickets/pass-email'
import { healPendingAdmissions, redeem, registerWithZoom, type TicketAdmission } from '@/lib/server/tickets/redeem'

// Each exported function is a public endpoint: every argument is untrusted.

export type TicketError =
  | 'invalid_input' | 'rate_limited' | 'not_found' | 'void' | 'expired' | 'outside_window' | 'no_entries' | 'full'
  | 'duplicate_email' | 'cancelled' | 'not_covered' | 'not_ticketed' | 'not_ready' | 'other_device' | 'failed'
type Fail = { ok: false; code: TicketError }
const fail = (code: TicketError): Fail => ({ ok: false, code })

/** Everyone joining one evening shares an event, so this bounds abuse, not a full house. */
const REGISTRATIONS_PER_HOUR = 300

const uuid = z.uuid()
const person = z.object({ name: z.string().trim().min(2).max(200), email: z.email().max(320) })

async function clientIp(): Promise<string> {
  const ip = ((await headers()).get('x-forwarded-for') ?? '').split(',')[0].trim()
  return ip === '' ? 'unknown' : ip
}

async function rememberDevice(row: { id: string; event_id: string }, endTime: string, token: string) {
  ;(await cookies()).set(deviceCookieName(row.id), token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: `/events/${row.event_id}`,
    expires: new Date(endTime),
  })
}

// ── Free registration ───────────────────────────────────────────────────────

export type RegisterResult = { ok: true; admissionId: string | null; ready: boolean } | Fail

export async function registerFree(input: { eventId: string; name: string; email: string }): Promise<RegisterResult> {
  const parsed = person.extend({ eventId: uuid }).safeParse(input)
  if (!parsed.success) return fail('invalid_input')
  const { eventId } = parsed.data
  let { name, email } = parsed.data

  if (!(await consumeRegistrationSlot({ shareLinkId: null, eventId, windowMs: 60 * 60 * 1000, max: REGISTRATIONS_PER_HOUR }))) {
    return fail('rate_limited')
  }
  const supabase = createServiceClient()
  try {
    const flow = await getTicketFlow(supabase, eventId)
    if (flow === null || flow.kind !== 'free') return fail('not_ticketed')
    if (flow.event.cancelled) return fail('cancelled')

    // A member registers as themself, whatever the request says.
    let profileId: string | null = null
    const { userId } = await auth()
    const user = userId ? await currentUser() : null
    const own = user === null ? undefined : verifiedEmails({
      emailAddresses: user.emailAddresses.filter((e) => e.id === user.primaryEmailAddressId),
    })[0]
    if (userId && own !== undefined) {
      const { data: profile, error } = await supabase.from('profiles').select('id, first_name, last_name').eq('clerk_id', userId).maybeSingle()
      if (error) throw error
      if (profile !== null) {
        profileId = profile.id
        email = own
        const full = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
        if (full !== '') name = full
      }
    }

    const { data, error } = await withFreshCodes(({ unlockCode, qrToken }) =>
      supabase.rpc('register_free_admission', {
        p_event_id: eventId,
        p_name: name,
        p_email: email,
        // Generated types drop SQL nullability; NULL is valid here.
        p_profile_id: profileId as string,
        p_mode: 'online',
        p_admitted_via: 'registration',
        p_actor: null as unknown as string,
        p_unlock_code: unlockCode,
        p_qr_token: qrToken,
      }),
    )
    if (error) return fail(ticketErrorCode(error) ?? 'failed')
    const { created, admission } = data as unknown as { created: boolean; admission: TicketAdmission }

    // Someone who only typed the address gets nothing on screen: the link goes to its inbox.
    if (!created) {
      await emailJoinLink(admission)
      return { ok: true, admissionId: null, ready: false }
    }
    const active = await registerQuietly(supabase, admission)
    const token = await claimFirstDevice(supabase, admission.id)
    if (token !== null) await rememberDevice(admission, flow.event.end_time, token)
    // A pending row gets its email from the healing job.
    if (active !== null) after(() => emailJoinLink(active))
    return { ok: true, admissionId: admission.id, ready: active !== null }
  } catch (err) {
    console.error('[tickets] registerFree', err instanceof Error ? err.name : 'error')
    return fail('failed')
  }
}

async function registerQuietly(supabase: ReturnType<typeof createServiceClient>, row: TicketAdmission) {
  try {
    return await registerWithZoom({ supabase, zoom: createZoomPort(supabase) }, row)
  } catch (err) {
    console.error('[tickets] left pending', row.id, err instanceof Error ? err.name : 'error')
    return null
  }
}

// ── Join with code ──────────────────────────────────────────────────────────

export type CodeResult =
  | { ok: true; holderName: string; entriesLeft: number; holderAdmitted: boolean; admitted: { position: number; name: string }[] }
  | Fail

type Loaded = { supabase: ReturnType<typeof createServiceClient>; pass: TicketPass; endTime: string; online: TicketAdmission[]; entriesLeft: number }

/** Every use of a code goes through here, so every use spends an attempt. */
async function loadByCode(eventId: string, code: string): Promise<Loaded | Fail> {
  if (!uuid.safeParse(eventId).success || typeof code !== 'string' || !/^\s*[A-Za-z0-9]{8}\s*$/.test(code)) return fail('not_found')
  if (!(await consumeCodeAttempt({ ip: await clientIp(), code }))) return fail('rate_limited')
  const supabase = createServiceClient()
  const flow = await getTicketFlow(supabase, eventId)
  if (flow === null || flow.kind !== 'code') return fail('not_ticketed')
  if (flow.event.cancelled) return fail('cancelled')
  if (onlineWindow(flow.event) !== 'open') return fail('outside_window')
  const pass = await findPass(supabase, { code })
  if (pass === null) return fail('not_found')
  if (pass.status === 'void') return fail('void')

  const { data: rows, error } = await supabase
    .from('ticket_admissions')
    .select('*')
    .eq('pass_id', pass.id)
    .in('status', ['pending_zoom', 'active'])
    .order('created_at')
    .order('id')
  if (error) throw error
  return {
    supabase,
    pass,
    endTime: flow.event.end_time,
    online: rows.filter((r) => r.event_id === eventId && r.mode === 'online'),
    entriesLeft: pass.entries_total - rows.length,
  }
}

const isFail = (value: Loaded | Fail): value is Fail => 'ok' in value

export async function checkCode(input: { eventId: string; code: string }): Promise<CodeResult> {
  try {
    const loaded = await loadByCode(input.eventId, input.code)
    if (isFail(loaded)) return loaded
    const { supabase, pass, online } = loaded
    after(() =>
      healPendingAdmissions({ supabase, zoom: createZoomPort(supabase), onActive: emailJoinLink }, { passId: pass.id }).catch((err) =>
        console.error('[tickets] heal failed', err instanceof Error ? err.name : 'error'),
      ),
    )
    return {
      ok: true,
      holderName: pass.holder_name,
      entriesLeft: loaded.entriesLeft,
      holderAdmitted: online.some((r) => r.attendee_email?.toLowerCase() === pass.holder_email.toLowerCase()),
      // Positions, not ids: an id would let the code's holder claim a guest's device.
      admitted: online.map((r, position) => ({ position, name: r.attendee_name })),
    }
  } catch (err) {
    console.error('[tickets] checkCode', err instanceof Error ? err.name : 'error')
    return fail('failed')
  }
}

export type RedeemCodeResult = { ok: true; admissionId: string | null; ready: boolean; emailed: number } | Fail

const redeemSchema = z.object({
  includeHolder: z.boolean(),
  guests: z.array(person).max(20),
})

export async function redeemCode(input: {
  eventId: string
  code: string
  includeHolder: boolean
  guests: { name: string; email: string }[]
}): Promise<RedeemCodeResult> {
  const parsed = redeemSchema.safeParse(input)
  if (!parsed.success || (!parsed.data.includeHolder && parsed.data.guests.length === 0)) return fail('invalid_input')
  try {
    const loaded = await loadByCode(input.eventId, input.code)
    if (isFail(loaded)) return loaded
    const { supabase, pass } = loaded
    const attendees = [
      ...(parsed.data.includeHolder ? [{ name: pass.holder_name, email: pass.holder_email }] : []),
      ...parsed.data.guests,
    ]
    const result = await redeem(
      { supabase, zoom: createZoomPort(supabase) },
      { passId: pass.id, eventId: input.eventId, attendees, mode: 'online', admittedVia: 'code', actorId: null },
    )
    if (!result.ok) return fail(result.code)

    const isHolder = (r: TicketAdmission) => r.attendee_email?.toLowerCase() === pass.holder_email.toLowerCase()
    const holder = parsed.data.includeHolder ? result.admissions.find(isHolder) : undefined
    if (holder !== undefined) {
      const token = await claimFirstDevice(supabase, holder.id)
      if (token !== null) await rememberDevice(holder, loaded.endTime, token)
    }
    // Pending rows get their email from the healing job.
    const others = result.admissions.filter((r) => r !== holder && r.status === 'active')
    after(() => Promise.all(others.map(emailJoinLink)))
    return { ok: true, admissionId: holder?.id ?? null, ready: holder?.status === 'active', emailed: result.admissions.length - (holder ? 1 : 0) }
  } catch (err) {
    console.error('[tickets] redeemCode', err instanceof Error ? err.name : 'error')
    return fail('failed')
  }
}

// ── Join, and moving it to another device ───────────────────────────────────

async function loadAdmission(supabase: ReturnType<typeof createServiceClient>, admissionId: string) {
  const { data, error } = await supabase
    .from('ticket_admissions')
    .select('*, calendar_events!inner(end_time, tickets_cancelled_at), ticket_passes!inner(status)')
    .eq('id', admissionId)
    .eq('mode', 'online')
    .in('status', ['pending_zoom', 'active'])
    .maybeSingle()
  if (error) throw error
  return data
}

/** The browser goes straight to `url` (Zoom). A POST, so a mail client opening the link claims nothing. */
export async function joinAdmission(input: { admissionId: string }): Promise<{ ok: true; url: string } | Fail> {
  if (!uuid.safeParse(input.admissionId).success) return fail('not_found')
  try {
    const supabase = createServiceClient()
    const row = await loadAdmission(supabase, input.admissionId)
    if (row === null) return fail('not_found')
    if (row.ticket_passes.status === 'void') return fail('void')
    if (row.calendar_events.tickets_cancelled_at !== null) return fail('cancelled')
    if (Date.now() >= Date.parse(row.calendar_events.end_time)) return fail('outside_window')

    if (!holdsDevice(row.device_token_hash, (await cookies()).get(deviceCookieName(row.id))?.value)) {
      const token = await claimFirstDevice(supabase, row.id)
      if (token === null) return fail('other_device')
      await rememberDevice(row, row.calendar_events.end_time, token)
    }
    const active = row.status === 'active' ? row : await registerQuietly(supabase, row)
    if (active === null || active.zoom_join_link === null) return fail('not_ready')
    return { ok: true, url: active.zoom_join_link }
  } catch (err) {
    console.error('[tickets] joinAdmission', err instanceof Error ? err.name : 'error')
    return fail('failed')
  }
}

async function sendCode(supabase: ReturnType<typeof createServiceClient>, row: TicketAdmission): Promise<{ ok: true } | Fail> {
  if (row.attendee_email === null) return fail('not_found')
  if (!(await mayEmail(row.attendee_email))) return fail('rate_limited')
  return (await sendDeviceCodeEmail(row, await createDeviceCode(supabase, row.id))) ? { ok: true } : fail('failed')
}

export async function requestDeviceCode(input: { admissionId: string }): Promise<{ ok: true } | Fail> {
  if (!uuid.safeParse(input.admissionId).success) return fail('not_found')
  try {
    const supabase = createServiceClient()
    const row = await loadAdmission(supabase, input.admissionId)
    return row === null ? fail('not_found') : await sendCode(supabase, row)
  } catch (err) {
    console.error('[tickets] requestDeviceCode', err instanceof Error ? err.name : 'error')
    return fail('failed')
  }
}

export async function confirmDeviceCode(input: { admissionId: string; code: string }): Promise<{ ok: true } | Fail> {
  if (!uuid.safeParse(input.admissionId).success || !/^\s*\d{6}\s*$/.test(String(input.code))) return fail('invalid_input')
  try {
    if (!(await consumeDeviceCodeAttempt(input.admissionId))) return fail('rate_limited')
    const supabase = createServiceClient()
    const row = await loadAdmission(supabase, input.admissionId)
    const token = row === null ? null : await moveDevice(supabase, row.id, input.code)
    if (row === null || token === null) return fail('not_found')
    await rememberDevice(row, row.calendar_events.end_time, token)
    return { ok: true }
  } catch (err) {
    console.error('[tickets] confirmDeviceCode', err instanceof Error ? err.name : 'error')
    return fail('failed')
  }
}

/** From the code screen: the person is named by position, and only their inbox gets the code. */
export async function requestDeviceCodeByPosition(input: { eventId: string; code: string; position: number }): Promise<{ ok: true } | Fail> {
  try {
    const loaded = await loadByCode(input.eventId, input.code)
    if (isFail(loaded)) return loaded
    const row = Number.isInteger(input.position) ? loaded.online[input.position] : undefined
    return row === undefined ? fail('not_found') : await sendCode(loaded.supabase, row)
  } catch (err) {
    console.error('[tickets] requestDeviceCodeByPosition', err instanceof Error ? err.name : 'error')
    return fail('failed')
  }
}

export async function confirmDeviceCodeByPosition(input: {
  eventId: string
  code: string
  position: number
  oneTimeCode: string
}): Promise<{ ok: true; admissionId: string } | Fail> {
  try {
    const loaded = await loadByCode(input.eventId, input.code)
    if (isFail(loaded)) return loaded
    const row = Number.isInteger(input.position) ? loaded.online[input.position] : undefined
    if (row === undefined) return fail('not_found')
    const result = await confirmDeviceCode({ admissionId: row.id, code: input.oneTimeCode })
    return result.ok ? { ok: true, admissionId: row.id } : result
  } catch (err) {
    console.error('[tickets] confirmDeviceCodeByPosition', err instanceof Error ? err.name : 'error')
    return fail('failed')
  }
}

// ── Lost code ───────────────────────────────────────────────────────────────

/** Always the same answer, at the same speed: the work runs after the response. */
export async function resendPasses(input: { email: string }): Promise<{ ok: true }> {
  const email = z.email().max(320).safeParse(input.email)
  if (!email.success) return { ok: true }
  const ip = await clientIp()
  after(async () => {
    try {
      if (!(await consumeCodeAttempt({ ip }))) return
      const supabase = createServiceClient()
      const { data: passes, error } = await supabase
        .from('ticket_passes')
        .select('*, ticket_products!inner(kind)')
        .ilike('holder_email', email.data.replace(/[\\%_]/g, '\\$&'))
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .neq('ticket_products.kind', 'free_registration')
        .limit(5)
      if (error) throw error
      for (const pass of passes) {
        if (!(await mayEmail(pass.holder_email))) return
        await sendPassCopy(pass)
      }
    } catch (err) {
      console.error('[tickets] resendPasses', err instanceof Error ? err.name : 'error')
    }
  })
  return { ok: true }
}
