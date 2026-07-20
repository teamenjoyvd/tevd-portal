'use server'

import { z } from 'zod'
import { randomBytes } from 'crypto'
import * as React from 'react'
import { createServiceClient } from '@/lib/supabase/service'
import { sendTransactionalEmail } from '@/lib/email/send'
import { renderEmailTemplate } from '@/lib/email/templates/render'
import { GuestEventMagicLinkEmail } from '@/lib/email/templates/GuestEventMagicLinkEmail'
import { notifySharerOfRegistration } from '@/lib/notifications/share-events'
import { getBaseUrl } from '@/lib/utils/base-url'

// -- Types --------------------------------------------------------------------

export type RegisterGuestState = { success: boolean; error?: string }

type Lang = 'en' | 'bg'

function getMagicLinkSubject(lang: Lang, eventTitle: string): string {
  return lang === 'bg'
    ? `Вашата връзка за присъединяване: ${eventTitle}`
    : `Your link to join: ${eventTitle}`
}

// -- Schema -------------------------------------------------------------------

const schema = z.object({
  name:       z.string().min(2).max(100).trim(),
  email:      z.string().email(),
  eventId:    z.string().uuid(),
  shareToken: z.string().optional(),
  lang:       z.enum(['en', 'bg']).default('en'),
})

// -- Action -------------------------------------------------------------------

export async function registerGuest(
  _prev: RegisterGuestState,
  formData: FormData,
): Promise<RegisterGuestState> {
  const parsed = schema.safeParse({
    name:       formData.get('name'),
    email:      formData.get('email'),
    eventId:    formData.get('eventId'),
    shareToken: formData.get('shareToken') ?? undefined,
    lang:       formData.get('lang') ?? undefined,
  })

  if (!parsed.success) {
    return { success: false, error: 'Please enter a valid name and email address.' }
  }

  const { name, email, eventId, shareToken, lang } = parsed.data
  const supabase = createServiceClient()

  // Verify event exists and has guest registration enabled
  const { data: event, error: eventError } = await supabase
    .from('calendar_events')
    .select('id, title, allow_guest_registration, end_time')
    .eq('id', eventId)
    .single()

  if (eventError || !event)            return { success: false, error: 'Event not found.' }
  if (!event.allow_guest_registration) return { success: false, error: 'Registration is not available for this event.' }
  if (new Date(event.end_time).getTime() < Date.now())
    return { success: false, error: 'This event has already ended.' }

  // Resolve share token → share_link_id (null-safe). A revoked link must not
  // attribute a new registration — treat it the same as no token.
  let shareLinkId: string | null = null
  if (shareToken) {
    const { data: shareLink } = await supabase
      .from('event_share_links')
      .select('id')
      .eq('token', shareToken)
      .eq('event_id', eventId)
      .is('revoked_at', null)
      .single()
    shareLinkId = shareLink?.id ?? null
  }

  // Reuse an existing, still-valid magic link for this (event, email) so a guest
  // who re-registers gets the SAME link resent rather than a fresh token that
  // silently invalidates the one already sitting in their inbox. Only the
  // attribution (share_link_id) and display name are refreshed. If there is no
  // prior registration, or the previous link has expired, mint a new token.
  const { data: existing } = await supabase
    .from('guest_registrations')
    .select('token, expires_at, share_link_id')
    .eq('event_id', eventId)
    .eq('email', email)
    .maybeSingle()

  const now      = Date.now()
  const reusable = existing != null && new Date(existing.expires_at).getTime() > now

  let token: string
  if (reusable) {
    token = existing.token
    // Preserve first-touch attribution: only overwrite share_link_id when this
    // registration arrived through a share link. A direct re-registration
    // (no token) must not null out a prior sharer's attribution.
    const { error: updateError } = await supabase
      .from('guest_registrations')
      .update({ name, lang, share_link_id: shareLinkId ?? existing.share_link_id })
      .eq('event_id', eventId)
      .eq('email', email)
    if (updateError) return { success: false, error: 'Registration failed. Please try again.' }
  } else {
    token = randomBytes(32).toString('hex')
    const expiresAt = new Date(new Date(event.end_time).getTime() + 3 * 60 * 60 * 1000).toISOString()
    // Upsert covers both the first registration (insert) and re-registration
    // after expiry (update the existing row with a fresh token/expiry). Keep
    // first-touch attribution when this re-registration carries no share link.
    const { error: upsertError } = await supabase
      .from('guest_registrations')
      .upsert(
        { event_id: eventId, email, name, lang, token, expires_at: expiresAt, share_link_id: shareLinkId ?? existing?.share_link_id ?? null },
        { onConflict: 'event_id,email', ignoreDuplicates: false },
      )
    if (upsertError) return { success: false, error: 'Registration failed. Please try again.' }
  }

  // Atomically increment click_count on the share link
  if (shareLinkId) {
    await supabase.rpc('increment_share_link_click', { link_id: shareLinkId })
  }

  // Build magic link from the resolved app base URL
  const magicLink = `${await getBaseUrl()}/events/${eventId}/join?token=${token}`

  const html = await renderEmailTemplate(
    React.createElement(GuestEventMagicLinkEmail, {
      name,
      eventTitle:   event.title,
      magicLinkUrl: magicLink,
      lang,
    }),
  )

  const subject = getMagicLinkSubject(lang, event.title)

  const result = await sendTransactionalEmail({
    to:       email,
    subject,
    html,
    template: 'guest_event_magic_link',
    meta:     { eventId, name },
  })

  if (!result.sent) return { success: false, error: 'Could not send access link. Please try again.' }

  // Notify sharer — fire-and-forget, must not block the response
  if (shareLinkId) {
    notifySharerOfRegistration(shareLinkId, name)
  }

  return { success: true }
}

// -- Resend link --------------------------------------------------------------
// Neutral by design: the response is IDENTICAL whether or not `email` has a
// registration for `eventId`, so this cannot be used to enumerate registered
// guests. Stopgap rate cap (moves into lib/rate-limit.ts in T5, 2607-DEV-589):
// max 3 magic-link sends/hour/recipient, counted from notification_delivery_log.

export type ResendGuestLinkState = { success: true }

const RESEND_RATE_LIMIT = 3
const RESEND_RATE_WINDOW_MS = 60 * 60 * 1000
const MAGIC_LINK_TEMPLATE = 'guest_event_magic_link'

const NEUTRAL_RESULT: ResendGuestLinkState = { success: true }

export async function resendGuestLink(eventId: string, email: string): Promise<ResendGuestLinkState> {
  const parsed = z.object({ eventId: z.string().uuid(), email: z.string().email() }).safeParse({ eventId, email })
  if (!parsed.success) return NEUTRAL_RESULT

  const supabase = createServiceClient()

  const { data: event } = await supabase
    .from('calendar_events')
    .select('id, title, allow_guest_registration, end_time')
    .eq('id', eventId)
    .single()

  if (!event || !event.allow_guest_registration) return NEUTRAL_RESULT
  if (new Date(event.end_time).getTime() < Date.now()) return NEUTRAL_RESULT

  const { data: reg } = await supabase
    .from('guest_registrations')
    .select('id, name, token, lang')
    .eq('event_id', eventId)
    .eq('email', email)
    .maybeSingle()

  if (!reg) return NEUTRAL_RESULT

  // Rate cap — count sends to this recipient in the trailing hour, regardless
  // of which event they were for (per-recipient, not per-event).
  const windowStart = new Date(Date.now() - RESEND_RATE_WINDOW_MS).toISOString()
  const { count } = await supabase
    .from('notification_delivery_log')
    .select('id', { count: 'exact', head: true })
    .eq('channel', 'email')
    .eq('template', MAGIC_LINK_TEMPLATE)
    .eq('recipient', email)
    .gte('created_at', windowStart)

  if ((count ?? 0) >= RESEND_RATE_LIMIT) return NEUTRAL_RESULT

  // Refresh expiry per the T2 rule (event.end_time + 3h); keep the existing
  // token so any copy of the link already sent still resolves.
  const expiresAt = new Date(new Date(event.end_time).getTime() + 3 * 60 * 60 * 1000).toISOString()
  await supabase
    .from('guest_registrations')
    .update({ expires_at: expiresAt })
    .eq('id', reg.id)

  const lang: Lang = reg.lang === 'bg' ? 'bg' : 'en'
  const magicLink = `${await getBaseUrl()}/events/${eventId}/join?token=${reg.token}`

  const html = await renderEmailTemplate(
    React.createElement(GuestEventMagicLinkEmail, {
      name:         reg.name,
      eventTitle:   event.title,
      magicLinkUrl: magicLink,
      lang,
    }),
  )

  const subject = getMagicLinkSubject(lang, event.title)

  await sendTransactionalEmail({
    to:       email,
    subject,
    html,
    template: MAGIC_LINK_TEMPLATE,
    meta:     { eventId, name: reg.name, resend: true },
  })

  return NEUTRAL_RESULT
}
