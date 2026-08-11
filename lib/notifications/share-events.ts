// ── lib/notifications/share-events.ts ────────────────────────────────────
// Non-blocking notification helpers for the share link lifecycle.
// Always call without await — a failing email must never block the user.

import * as React from 'react'
import { clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendNotificationEmail, type SendEmailPayload } from '@/lib/email/send'
import { consumeEmailCap } from '@/lib/rate-limit'
import { renderEmailTemplate } from '@/lib/email/templates/render'
import { ShareGuestRegisteredEmail } from '@/lib/email/templates/ShareGuestRegisteredEmail'
import { ShareGuestAttendedEmail } from '@/lib/email/templates/ShareGuestAttendedEmail'
import { ShareGuestCancelledEmail } from '@/lib/email/templates/ShareGuestCancelledEmail'

// ── Caps ─────────────────────────────────────────────────────────────────
// Same shape as MEMBER_EMAIL_DAILY_CAP / GUEST_EMAIL_DAILY_CAP, but keyed per
// TEMPLATE rather than per recipient (2608-DEV-715): a widely-circulated link
// can produce a burst of registrations, and that burst must not consume the
// budget that would otherwise deliver the sharer's *cancellation* notice.
const SHARE_EMAIL_DAILY_CAP = 10
const SHARE_EMAIL_DAILY_WINDOW_MS = 24 * 60 * 60 * 1000

// ── Internal resolver ────────────────────────────────────────────────────

type Lang = 'en' | 'bg'

type ShareLinkContext = {
  sharerEmail:  string
  sharerName:   string
  eventTitle:   string
  guestName:    string
  lang:         Lang
}

/**
 * The address to notify a sharer at, or null when there is none.
 *
 * `contact_email` is the member's stated preference and wins outright. It is
 * nullable and unset for a sizeable share of real profiles (12 of 68 active
 * share links on 2026-08-09), which used to mean silent non-delivery — hence
 * the fallback to the Clerk primary address, which every authenticating member
 * necessarily has and which Clerk has verified. Profiles with no `clerk_id`
 * (admin-created spouse/co-owner rows) still resolve to null: there is no
 * address to reach them at.
 */
async function resolveSharerEmail(profile: {
  contact_email: string | null
  clerk_id:      string | null
}): Promise<string | null> {
  // Explicit empty-string check: a blank contact_email is not an address, but
  // it must not shadow the Clerk fallback either.
  const preferred = profile.contact_email?.trim()
  if (preferred != null && preferred !== '') return preferred

  const clerkId = profile.clerk_id?.trim()
  if (clerkId == null || clerkId === '') return null

  try {
    const clerk = await clerkClient()
    const user = await clerk.users.getUser(clerkId)
    return user.primaryEmailAddress?.emailAddress ?? null
  } catch (err) {
    // A Clerk outage must not throw inside a fire-and-forget path — the caller
    // treats null as "nothing to send", which is the correct degradation.
    console.error('Failed to resolve sharer email from Clerk:', err)
    return null
  }
}

async function resolveShareLinkContext(
  shareLinkId: string,
  guestName: string,
): Promise<ShareLinkContext | null> {
  const supabase = createServiceClient()

  // `contact_email` — `profiles` has no `email` column. The previous name was
  // rejected by PostgREST, so every notification below silently no-opped
  // (2608-DEV-704). The embeds need no FK hint: event_share_links has exactly
  // one FK to each of profiles and calendar_events.
  const { data, error } = await supabase
    .from('event_share_links')
    .select(`
      lang,
      profile:profiles ( first_name, last_name, contact_email, clerk_id ),
      event:calendar_events ( title )
    `)
    .eq('id', shareLinkId)
    .single()

  if (error) {
    console.error('Failed to resolve share link context:', error.message)
    return null
  }
  if (!data) return null

  // Deliberately uncast: the generated Database types check these column names
  // at compile time, so a future rename fails `npm run check-types` instead of
  // silently resolving to null at runtime.
  const { profile, event } = data

  if (!profile || !event?.title) return null

  const sharerEmail = await resolveSharerEmail(profile)
  if (sharerEmail === null) return null

  return {
    sharerEmail,
    sharerName:  `${profile.first_name} ${profile.last_name}`.trim(),
    eventTitle:  event.title,
    guestName,
    lang:        data.lang === 'bg' ? 'bg' : 'en',
  }
}

/**
 * Cap, then send. These are notifications, not transactional mail: the sharer
 * did not request each individual message, so both the `email_config.enabled`
 * master switch and the per-template admin toggle apply (2608-DEV-715). Guest
 * magic links stay on `sendTransactionalEmail` — there the email IS the feature.
 */
async function sendShareNotification(payload: SendEmailPayload): Promise<void> {
  const withinDailyCap = await consumeEmailCap({
    recipient: payload.to,
    template:  payload.template,
    windowMs:  SHARE_EMAIL_DAILY_WINDOW_MS,
    max:       SHARE_EMAIL_DAILY_CAP,
  })
  if (!withinDailyCap) return

  await sendNotificationEmail(payload)
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
      await sendShareNotification({
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
      await sendShareNotification({
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
      await sendShareNotification({
        to:       ctx.sharerEmail,
        subject,
        html,
        template: 'share_guest_cancelled',
        meta:     { shareLinkId, guestName },
      })
    })
    .catch(err => { console.error('Failed to notify sharer of cancellation:', err) })
}
