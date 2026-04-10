import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/service'

// -- Lazy-init Resend client --------------------------------------------------
// Not constructed at module load so missing key in dev doesn't crash boot.
let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

// -- Settings cache -----------------------------------------------------------
// The email_config row is fetched once per cold start; re-fetched if stale.
let _configCache: EmailConfig | null = null
let _configFetchedAt = 0
const CONFIG_TTL_MS = 60_000 // 1 minute

export type EmailConfig = {
  enabled: boolean
  notification_types: Record<string, boolean>
  alert_recipient: string
}

export async function getEmailConfig(): Promise<EmailConfig> {
  const now = Date.now()
  if (_configCache && now - _configFetchedAt < CONFIG_TTL_MS) return _configCache

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'email_config')
    .single()

  _configCache = (data?.value as EmailConfig) ?? { enabled: false, notification_types: {}, alert_recipient: '' }
  _configFetchedAt = now
  return _configCache
}

// -- Shared payload type ------------------------------------------------------

export type SendEmailPayload = {
  /** Resend "from" address. Defaults to the team noreply. */
  from?: string
  to: string
  subject: string
  /** Pre-rendered HTML string -- use renderEmailTemplate() from templates/render.ts */
  html: string
  /** Template key used for log + admin toggle check e.g. 'trip_registration_status' */
  template: string
  /** Any serialisable metadata to store in email_log.payload (profile IDs, amounts...) */
  meta?: Record<string, unknown>
}

// -- Notification dispatcher --------------------------------------------------

/**
 * Resilient notification email dispatcher.
 *
 * - Never throws -- all errors are caught and written to email_log.
 * - Respects the system-wide `email_config.enabled` flag.
 * - Respects per-notification-type toggles in `email_config.notification_types`.
 * - Every attempt (success or failure) is written to email_log for auditability.
 */
export async function sendNotificationEmail(payload: SendEmailPayload): Promise<void> {
  const supabase = createServiceClient()
  const config = await getEmailConfig()

  // -- System-level gate ------------------------------------------------------
  if (!config.enabled) return

  // -- Per-type gate ----------------------------------------------------------
  if (config.notification_types[payload.template] === false) return

  const from = payload.from ?? 'TeamEnjoyVD <noreply@teamenjoyvd.com>'

  let status = 'pending'
  let resendId: string | null = null
  let errorMsg: string | null = null

  try {
    const { data, error } = await getResend().emails.send({
      from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    })

    if (error) throw new Error(error.message)
    resendId = data?.id ?? null
    status   = 'sent'
  } catch (err) {
    status   = 'failed'
    errorMsg = err instanceof Error ? err.message : String(err)
  }

  // -- Audit log -- never throws ----------------------------------------------
  try {
    await supabase.from('email_log').insert({
      template:  payload.template,
      recipient: payload.to,
      payload:   (payload.meta ?? {}) as import('@/types/supabase').Json,
      status,
      resend_id: resendId,
      error:     errorMsg,
      sent_at:   status === 'sent' ? new Date().toISOString() : null,
    })
  } catch {
    // Logging failure must never propagate -- email is already sent/failed.
  }
}

// -- Transactional dispatcher -------------------------------------------------

export type TransactionalEmailResult =
  | { sent: true }
  | { sent: false; error: string }

/**
 * Transactional email dispatcher for flows where the email IS the feature
 * (e.g. magic links, access links).
 *
 * - Bypasses `email_config.enabled` -- a master kill switch must not block auth flows.
 * - Bypasses per-type toggles.
 * - Returns a typed result -- caller decides how to handle failure.
 * - Does NOT swallow errors.
 * - Still writes to email_log for auditability.
 */
export async function sendTransactionalEmail(
  payload: SendEmailPayload,
): Promise<TransactionalEmailResult> {
  const supabase = createServiceClient()
  const from = payload.from ?? 'TeamEnjoyVD <noreply@teamenjoyvd.com>'

  let status = 'pending'
  let resendId: string | null = null
  let errorMsg: string | null = null

  try {
    const { data, error } = await getResend().emails.send({
      from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    })

    if (error) throw new Error(error.message)
    resendId = data?.id ?? null
    status   = 'sent'
  } catch (err) {
    status   = 'failed'
    errorMsg = err instanceof Error ? err.message : String(err)
  }

  // -- Audit log -- never throws ----------------------------------------------
  try {
    await supabase.from('email_log').insert({
      template:  payload.template,
      recipient: payload.to,
      payload:   (payload.meta ?? {}) as import('@/types/supabase').Json,
      status,
      resend_id: resendId,
      error:     errorMsg,
      sent_at:   status === 'sent' ? new Date().toISOString() : null,
    })
  } catch {
    // Logging failure must never propagate.
  }

  if (status === 'sent') return { sent: true }
  return { sent: false, error: errorMsg ?? 'Unknown error' }
}
