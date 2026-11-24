import * as React from 'react'
import QRCode from 'qrcode'
import type { createServiceClient } from '@/lib/supabase/service'
import { sendTransactionalEmail } from '@/lib/email/send'
import { renderEmailTemplate } from '@/lib/email/templates/render'
import { TicketPassEmail } from '@/lib/email/templates/TicketPassEmail'
import { formatDate } from '@/lib/format'
import type { TicketPass } from './passes'

type ServiceClient = ReturnType<typeof createServiceClient>

export const MAX_EMAIL_ATTEMPTS = 3
const CLAIM_HOLD_MS = 2 * 60_000
const QR_CONTENT_ID = 'ticket-qr'

/** `email_attempts` is the compare-and-swap value, so two senders cannot both win. */
async function claim(supabase: ServiceClient, passId: string): Promise<TicketPass | null> {
  const { data: pass, error } = await supabase.from('ticket_passes').select('*').eq('id', passId).maybeSingle()
  if (error) throw error
  if (pass === null || pass.email_sent_at !== null || pass.status === 'void') return null
  if (pass.email_attempts >= MAX_EMAIL_ATTEMPTS) return null
  if (pass.email_claimed_at !== null && Date.parse(pass.email_claimed_at) > Date.now() - CLAIM_HOLD_MS) return null

  const { data, error: claimError } = await supabase
    .from('ticket_passes')
    .update({ email_claimed_at: new Date().toISOString(), email_attempts: pass.email_attempts + 1 })
    .eq('id', passId)
    .is('email_sent_at', null)
    .eq('email_attempts', pass.email_attempts)
    .select()
    .maybeSingle()
  if (claimError) throw claimError
  return data
}

/** Returns true when this call sent the email. */
export async function sendPassEmail(supabase: ServiceClient, passId: string): Promise<boolean> {
  const pass = await claim(supabase, passId)
  if (pass === null) return false

  const qr = await QRCode.toBuffer(pass.qr_token, { width: 320, margin: 2 })
  const html = await renderEmailTemplate(
    React.createElement(TicketPassEmail, {
      name: pass.holder_name,
      code: pass.unlock_code,
      entries: pass.entries_total,
      expiresLabel: formatDate(pass.expires_at),
      qrSrc: `cid:${QR_CONTENT_ID}`,
    }),
  )
  const result = await sendTransactionalEmail({
    to: pass.holder_email,
    subject: 'Вашият билет / Your ticket',
    html,
    template: 'ticket_pass',
    meta: { pass_id: pass.id },
    attachments: [{ filename: 'ticket-qr.png', content: qr.toString('base64'), contentId: QR_CONTENT_ID }],
  })
  if (!result.sent) return false

  const { error } = await supabase
    .from('ticket_passes')
    .update({ email_sent_at: new Date().toISOString() })
    .eq('id', pass.id)
  if (error) console.error('[tickets] email sent but not marked', pass.id)
  return true
}
