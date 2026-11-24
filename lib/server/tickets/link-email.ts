import * as React from 'react'
import { sendTransactionalEmail } from '@/lib/email/send'
import { renderEmailTemplate } from '@/lib/email/templates/render'
import { TicketLinkEmail } from '@/lib/email/templates/TicketLinkEmail'
import { consumeEmailCap } from '@/lib/rate-limit'
import { getBaseUrl } from '@/lib/utils/base-url'
import type { TicketAdmission } from './redeem'

type Recipient = Pick<TicketAdmission, 'id' | 'event_id' | 'attendee_name' | 'attendee_email'>

/** Same daily bucket as the guest emails: one cap per person, not per template. */
export const mayEmail = (email: string) =>
  consumeEmailCap({ recipient: email.toLowerCase(), windowMs: 24 * 60 * 60 * 1000, max: 10 })

/** Never throws: the admission exists whether or not the email leaves. */
export async function emailJoinLink(row: Recipient): Promise<void> {
  try {
    if (row.attendee_email !== null && (await mayEmail(row.attendee_email))) await sendJoinLinkEmail(row)
  } catch (err) {
    console.error('[tickets] link email failed', row.id, err instanceof Error ? err.name : 'error')
  }
}

/** The portal's join page for one admission. Never a Zoom link. */
export async function sendJoinLinkEmail(row: Recipient): Promise<boolean> {
  if (row.attendee_email === null) return false
  const url = `${await getBaseUrl()}/events/${row.event_id}/join?a=${row.id}`
  const result = await sendTransactionalEmail({
    to: row.attendee_email,
    subject: 'Вашата връзка за включване / Your link to join',
    html: await renderEmailTemplate(React.createElement(TicketLinkEmail, { name: row.attendee_name, url })),
    template: 'ticket_link',
    meta: { admission_id: row.id },
  })
  return result.sent
}

export async function sendDeviceCodeEmail(row: Recipient, code: string): Promise<boolean> {
  if (row.attendee_email === null) return false
  const result = await sendTransactionalEmail({
    to: row.attendee_email,
    subject: 'Еднократен код / One-time code',
    html: await renderEmailTemplate(React.createElement(TicketLinkEmail, { name: row.attendee_name, code })),
    template: 'ticket_device_code',
    meta: { admission_id: row.id },
  })
  return result.sent
}
