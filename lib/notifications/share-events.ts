// ── lib/notifications/share-events.ts ────────────────────────────────────
// Non-blocking notification helpers for the share link lifecycle.
// Always call without await — a failing email must never block the user.

import * as React from 'react'
import { createServiceClient } from '@/lib/supabase/service'
import { sendTransactionalEmail } from '@/lib/email/send'
import { renderEmailTemplate } from '@/lib/email/templates/render'
import { ShareGuestRegisteredEmail } from '@/lib/email/templates/ShareGuestRegisteredEmail'
import { ShareGuestAttendedEmail } from '@/lib/email/templates/ShareGuestAttendedEmail'
import { ShareGuestCancelledEmail } from '@/lib/email/templates/ShareGuestCancelledEmail'

// ── Internal resolver ────────────────────────────────────────────────────

type Lang = 'en' | 'bg'

type ShareLinkContext = {
  sharerEmail:  string
  sharerName:   string
  eventTitle:   string
  guestName:    string
  lang:         Lang
}

async function resolveShareLinkContext(
  shareLinkId: string,
  guestName: string,
): Promise<ShareLinkContext | null> {
  const supabase = createServiceClient()

  const { data } = await supabase
    .from('event_share_links')
    .select(`
      lang,
      profile:profiles ( first_name, last_name, email ),
      event:calendar_events ( title )
    `)
    .eq('id', shareLinkId)
    .single()

  if (!data) return null

  const profile = data.profile as unknown as { first_name: string; last_name: string; email: string } | null
  const event   = data.event   as unknown as { title: string } | null

  if (!profile?.email || !event?.title) return null

  return {
    sharerEmail: profile.email,
    sharerName:  `${profile.first_name} ${profile.last_name}`.trim(),
    eventTitle:  event.title,
    guestName,
    lang:        data.lang === 'bg' ? 'bg' : 'en',
  }
}

// ── Public API ────────────────────────────────────────────────────────────

/** Fire-and-forget: notify sharer that a guest registered through their link. */
export function notifySharerOfRegistration(shareLinkId: string, guestName: string): void {
  resolveShareLinkContext(shareLinkId, guestName)
    .then(async ctx => {
      if (!ctx) return
      const html = await renderEmailTemplate(
        React.createElement(ShareGuestRegisteredEmail, {
          sharerName: ctx.sharerName,
          guestName:  ctx.guestName,
          eventTitle: ctx.eventTitle,
          lang:       ctx.lang,
        }),
      )
      const subject = ctx.lang === 'bg'
        ? `${ctx.guestName} се регистрира за ${ctx.eventTitle}`
        : `${ctx.guestName} registered for ${ctx.eventTitle}`
      await sendTransactionalEmail({
        to:       ctx.sharerEmail,
        subject,
        html,
        template: 'share_guest_registered',
        meta:     { shareLinkId, guestName },
      })
    })
    .catch(err => { console.error('Failed to notify sharer of registration:', err) })
}

/** Fire-and-forget: notify sharer that a guest joined the meeting. */
export function notifySharerOfAttendance(shareLinkId: string, guestName: string): void {
  resolveShareLinkContext(shareLinkId, guestName)
    .then(async ctx => {
      if (!ctx) return
      const html = await renderEmailTemplate(
        React.createElement(ShareGuestAttendedEmail, {
          sharerName: ctx.sharerName,
          guestName:  ctx.guestName,
          eventTitle: ctx.eventTitle,
          lang:       ctx.lang,
        }),
      )
      const subject = ctx.lang === 'bg'
        ? `${ctx.guestName} се присъедини към ${ctx.eventTitle}`
        : `${ctx.guestName} joined ${ctx.eventTitle}`
      await sendTransactionalEmail({
        to:       ctx.sharerEmail,
        subject,
        html,
        template: 'share_guest_attended',
        meta:     { shareLinkId, guestName },
      })
    })
    .catch(err => { console.error('Failed to notify sharer of attendance:', err) })
}

/** Fire-and-forget: notify sharer that a guest cancelled their registration. */
export function notifySharerOfCancellation(shareLinkId: string, guestName: string): void {
  resolveShareLinkContext(shareLinkId, guestName)
    .then(async ctx => {
      if (!ctx) return
      const html = await renderEmailTemplate(
        React.createElement(ShareGuestCancelledEmail, {
          sharerName: ctx.sharerName,
          guestName:  ctx.guestName,
          eventTitle: ctx.eventTitle,
          lang:       ctx.lang,
        }),
      )
      const subject = ctx.lang === 'bg'
        ? `${ctx.guestName} се отказа от ${ctx.eventTitle}`
        : `${ctx.guestName} cancelled for ${ctx.eventTitle}`
      await sendTransactionalEmail({
        to:       ctx.sharerEmail,
        subject,
        html,
        template: 'share_guest_cancelled',
        meta:     { shareLinkId, guestName },
      })
    })
    .catch(err => { console.error('Failed to notify sharer of cancellation:', err) })
}
