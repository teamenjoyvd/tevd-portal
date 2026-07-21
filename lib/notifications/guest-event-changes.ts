// ── lib/notifications/guest-event-changes.ts ─────────────────────────────
// Non-blocking notification helpers for the event-change/cancel guest
// lifecycle. Always call without await — a failing email must never block
// the admin request. Mirrors lib/notifications/share-events.ts.

import * as React from 'react'
import { createServiceClient } from '@/lib/supabase/service'
import { sendTransactionalEmail } from '@/lib/email/send'
import { renderEmailTemplate } from '@/lib/email/templates/render'
import { GuestEventUpdatedEmail, type ChangedField } from '@/lib/email/templates/GuestEventUpdatedEmail'
import { GuestEventCancelledEmail } from '@/lib/email/templates/GuestEventCancelledEmail'
import { checkEmailCap } from '@/lib/rate-limit'
import { formatDateTime } from '@/lib/format'

type Lang = 'en' | 'bg'

// Same daily cap shape as lib/actions/guest-registration.ts's
// GUEST_EMAIL_DAILY_CAP — keeps admin-triggered notification email volume
// under the same per-recipient abuse guard as guest self-service sends.
const GUEST_EMAIL_DAILY_CAP = 10
const GUEST_EMAIL_DAILY_WINDOW_MS = 24 * 60 * 60 * 1000

// Fields whose change on an admin edit is worth notifying registered guests
// about. Kept in sync with the `allowed` PATCH fields in
// app/api/admin/calendar/[id]/route.ts (only the subset relevant to a guest
// actually attending).
export const TRACKED_FIELDS = ['start_time', 'end_time', 'meeting_url'] as const
export type TrackedField = (typeof TRACKED_FIELDS)[number]

export type DiffableEvent = {
  start_time:  string
  end_time:    string
  meeting_url: string | null
}

function formatFieldValue(field: TrackedField, value: string | null): string {
  if (value == null || value === '') return '—'
  if (field === 'start_time' || field === 'end_time') return formatDateTime(value)
  return value
}

/** Diffs the tracked fields of an event update. Empty array = no notifiable change. */
export function diffEventFields(prev: DiffableEvent, next: DiffableEvent): ChangedField[] {
  const changed: ChangedField[] = []
  for (const field of TRACKED_FIELDS) {
    const oldRaw = prev[field]
    const newRaw = next[field]
    if (oldRaw === newRaw) continue
    changed.push({
      field,
      oldValue: formatFieldValue(field, oldRaw),
      newValue: formatFieldValue(field, newRaw),
    })
  }
  return changed
}

type Recipient = { email: string; name: string; lang: Lang }

async function resolveActiveRecipients(eventId: string): Promise<{ eventTitle: string; recipients: Recipient[] } | null> {
  const supabase = createServiceClient()

  const { data: event } = await supabase
    .from('calendar_events')
    .select('title')
    .eq('id', eventId)
    .single()

  if (!event) return null

  const { data: regs } = await supabase
    .from('guest_registrations')
    .select('email, name, lang')
    .eq('event_id', eventId)
    .is('cancelled_at', null)
    .gt('expires_at', new Date().toISOString())

  return {
    eventTitle: event.title,
    recipients: (regs ?? []).map(r => ({
      email: r.email,
      name:  r.name,
      lang:  r.lang === 'bg' ? 'bg' : 'en',
    })),
  }
}

/** Fire-and-forget: notify all active guest registrants that tracked event fields changed. */
export function notifyGuestsOfEventUpdate(eventId: string, changedFields: ChangedField[]): void {
  if (changedFields.length === 0) return

  resolveActiveRecipients(eventId)
    .then(async ctx => {
      if (!ctx) return
      for (const recipient of ctx.recipients) {
        const withinDailyCap = await checkEmailCap({
          recipient: recipient.email,
          windowMs:  GUEST_EMAIL_DAILY_WINDOW_MS,
          max:       GUEST_EMAIL_DAILY_CAP,
        })
        if (!withinDailyCap) continue

        const html = await renderEmailTemplate(
          React.createElement(GuestEventUpdatedEmail, {
            guestName:  recipient.name,
            eventTitle: ctx.eventTitle,
            changedFields,
            lang:       recipient.lang,
          }),
        )
        const subject = recipient.lang === 'bg'
          ? `Промяна в детайлите на ${ctx.eventTitle}`
          : `Details changed for ${ctx.eventTitle}`

        await sendTransactionalEmail({
          to:       recipient.email,
          subject,
          html,
          template: 'guest_event_updated',
          meta:     { eventId },
        })
      }
    })
    .catch(err => { console.error('Failed to notify guests of event update:', err) })
}

type CancelRecipient = { email: string; name: string; lang: Lang }

/** Fire-and-forget: notify a fixed set of guest registrants that the event was cancelled. */
export function notifyGuestsOfEventCancellation(eventTitle: string, recipients: CancelRecipient[]): void {
  if (recipients.length === 0) return

  ;(async () => {
    for (const recipient of recipients) {
      const withinDailyCap = await checkEmailCap({
        recipient: recipient.email,
        windowMs:  GUEST_EMAIL_DAILY_WINDOW_MS,
        max:       GUEST_EMAIL_DAILY_CAP,
      })
      if (!withinDailyCap) continue

      const html = await renderEmailTemplate(
        React.createElement(GuestEventCancelledEmail, {
          guestName:  recipient.name,
          eventTitle,
          lang:       recipient.lang,
        }),
      )
      const subject = recipient.lang === 'bg'
        ? `${eventTitle} беше отменено`
        : `${eventTitle} has been cancelled`

      await sendTransactionalEmail({
        to:       recipient.email,
        subject,
        html,
        template: 'guest_event_cancelled',
        meta:     { eventTitle },
      })
    }
  })().catch(err => { console.error('Failed to notify guests of event cancellation:', err) })
}
