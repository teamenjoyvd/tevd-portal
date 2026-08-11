import * as React from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { notifySharerOfRegistration, notifySharerOfCancellation } from '@/lib/notifications/share-events'
import { sendTransactionalEmail } from '@/lib/email/send'
import { renderEmailTemplate } from '@/lib/email/templates/render'
import { MemberEventConfirmationEmail } from '@/lib/email/templates/MemberEventConfirmationEmail'
import { buildGoogleCalUrl, buildOutlookUrl } from '@/lib/calendar-links'
import { getBaseUrl } from '@/lib/utils/base-url'
import { consumeEmailCap } from '@/lib/rate-limit'
import { countAttendeesForCapacity, isCapacityViolation } from '@/lib/server/event-capacity'
import { formatLongDate, formatLongDateEn, formatTime } from '@/lib/format'

type Lang = 'en' | 'bg'

// Same recipient-wide daily bucket the guest flow consumes
// (lib/actions/guest-registration.ts:46-47) — one cap per human, not one per
// template. Values are duplicated rather than imported because that module is
// 'use server', which may only export async functions.
const MEMBER_EMAIL_DAILY_CAP = 10
const MEMBER_EMAIL_DAILY_WINDOW_MS = 24 * 60 * 60 * 1000

const CONFIRMATION_TEMPLATE = 'member_event_confirmation'

// Module-local, matching lib/actions/guest-registration.ts:20-24 — email
// subjects are not UI strings and deliberately stay out of lib/i18n.
function getMemberConfirmationSubject(lang: Lang, eventTitle: string): string {
  return lang === 'bg'
    ? `Присъствието ви е потвърдено: ${eventTitle}`
    : `You're attending: ${eventTitle}`
}

type ConfirmationEvent = {
  title: string
  start_time: string
  end_time: string
  meeting_url: string | null
}

/**
 * Member attendance confirmation (D4). Sent only where attendEvent creates or
 * reactivates a registration — never on the already-active idempotent return,
 * consistent with 2608-DEV-706's decision not to re-notify the sharer there.
 *
 * Never throws and never fails the attend: the registration is already
 * committed by the time this runs, so a missing NEXT_PUBLIC_APP_URL, a Resend
 * outage or a render error must not turn a successful attend into an error
 * response (the failure mode #713 describes on the guest path).
 *
 * Returns whether an email actually went out, so the caller's success copy can
 * avoid claiming one was sent.
 */
async function sendMemberConfirmation(
  contactEmail: string | null,
  eventId: string,
  event: ConfirmationEvent,
  profileName: string,
  lang: Lang,
): Promise<boolean> {
  // No address on file — skip silently. Attending is still a success.
  if (contactEmail === null || contactEmail === '') return false

  try {
    // The slot is spent here, not at send time — a failed send still counted.
    // Deliberate, and the same rule the guest path follows
    // (lib/actions/guest-registration.ts:204-206, 2608-DEV-625): the cap exists
    // to bound attempts, and retry-until-success would otherwise be uncapped.
    const withinDailyCap = await consumeEmailCap({
      recipient: contactEmail,
      windowMs: MEMBER_EMAIL_DAILY_WINDOW_MS,
      max: MEMBER_EMAIL_DAILY_CAP,
    })
    if (!withinDailyCap) return false

    const baseUrl = await getBaseUrl()
    // No token: a member records attendance by authenticating, so this URL is
    // safe in an inbox.
    const joinUrl = `${baseUrl}/events/${eventId}/join`

    const html = await renderEmailTemplate(
      React.createElement(MemberEventConfirmationEmail, {
        name: profileName,
        eventTitle: event.title,
        // formatLongDate is bg-BG by contract, so an en email would otherwise
        // carry a Bulgarian weekday (2608-DEV-707 review). formatTime is 24h
        // digits in both locales and needs no twin.
        eventDateLabel: `${lang === 'bg' ? formatLongDate(event.start_time) : formatLongDateEn(event.start_time)}, ${formatTime(event.start_time)} – ${formatTime(event.end_time)}`,
        meetingUrl: event.meeting_url,
        joinUrl,
        googleCalUrl: buildGoogleCalUrl(event.title, event.start_time, event.end_time, event.meeting_url),
        outlookUrl: buildOutlookUrl(event.title, event.start_time, event.end_time, event.meeting_url),
        lang,
      }),
    )

    const result = await sendTransactionalEmail({
      to: contactEmail,
      subject: getMemberConfirmationSubject(lang, event.title),
      html,
      template: CONFIRMATION_TEMPLATE,
      meta: { eventId, name: profileName },
    })

    return result.sent
  } catch (err) {
    console.error('Failed to send member attendance confirmation:', err)
    return false
  }
}

// Click-credit is a metric, not part of the registration contract — an RPC
// failure here must not turn an already-committed registration into an
// error response for the caller.
async function creditShareLink(
  supabase: SupabaseClient,
  shareLinkId: string | null,
  profileName: string
): Promise<void> {
  if (!shareLinkId) return
  const { error } = await supabase.rpc('increment_share_link_click', { link_id: shareLinkId })
  if (error) console.error('Failed to increment share link click:', error)
  notifySharerOfRegistration(shareLinkId, profileName)
}

// -- Attend -------------------------------------------------------------------
// D1 one-tap attend + D9 adopt-don't-duplicate, for an authenticated member.
// Mirrors lib/actions/guest-registration.ts step for step, with three
// deliberate differences: no self-attribution, no consumeRegistrationSlot
// (authenticated + idempotent under the unique index covers the abuse case
// consumeRegistrationSlot exists for), and adopt-or-insert instead of a bare
// upsert.

export type AttendMemberResult =
  /** `emailed` is false whenever no confirmation went out — no contact_email, over cap, or a send failure. */
  | { success: true; registrationId: string; emailed: boolean }
  | { success: false; error: string }

// Shared by all three writes below. The capacity check earlier in attendEvent is
// the fast path; trg_enforce_event_guest_capacity (2608-DEV-718) is what holds
// the line when two attends race near the limit, and losing that race is "the
// event is full" — not a transient failure worth retrying. English-only, like
// every other string in this module: the caller localizes.
const CAPACITY_ERROR = 'This event has reached its guest capacity.'
const WRITE_ERROR = 'Could not attend. Please try again.'

function attendWriteError(error: { code?: string } | null): { success: false; error: string } {
  return { success: false, error: isCapacityViolation(error) ? CAPACITY_ERROR : WRITE_ERROR }
}

export type AttendMemberParams = {
  eventId: string
  profileId: string
  profileRole: string
  profileName: string
  contactEmail: string | null
  shareToken?: string
  /**
   * Confirmation-email language. `profiles` has no `lang` column, so the
   * caller resolves it (getLangFromCookies) and passes it down.
   */
  lang?: Lang
}

export async function attendEvent(
  supabase: SupabaseClient,
  params: AttendMemberParams
): Promise<AttendMemberResult> {
  const { eventId, profileId, profileRole, profileName, contactEmail, shareToken, lang = 'en' } = params

  if (profileRole === 'guest') return { success: false, error: 'Guests cannot use member attend.' }

  const { data: event, error: eventError } = await supabase
    .from('calendar_events')
    .select('id, title, allow_guest_registration, start_time, end_time, guest_capacity, meeting_url')
    .eq('id', eventId)
    .single()

  if (eventError || !event)                    return { success: false, error: 'Event not found.' }
  if (event.allow_guest_registration !== true) return { success: false, error: 'Registration is not available for this event.' }
  if (new Date(event.end_time).getTime() < Date.now())
    return { success: false, error: 'This event has already ended.' }

  // Resolve share token -> share_link_id, same revoked-link rule as the guest
  // path (lib/actions/guest-registration.ts:98-108). Self-attribution is
  // dropped: a member must not credit their own link.
  let shareLinkId: string | null = null
  if (shareToken) {
    const { data: shareLink } = await supabase
      .from('event_share_links')
      .select('id, profile_id')
      .eq('token', shareToken)
      .eq('event_id', eventId)
      .is('revoked_at', null)
      .single()
    if (shareLink && shareLink.profile_id !== profileId) shareLinkId = shareLink.id
  }

  // Existing registration for this member+event, any state — guarded by
  // guest_registrations_event_profile_uniq (event_id, profile_id).
  const { data: existing } = await supabase
    .from('guest_registrations')
    .select('id, cancelled_at, share_link_id')
    .eq('event_id', eventId)
    .eq('profile_id', profileId)
    .maybeSingle()

  // Already active — idempotent no-op success. No re-notify: a repeat tap on
  // an already-attending member is not a new registration event.
  if (existing && existing.cancelled_at === null) {
    return { success: true, registrationId: existing.id, emailed: false }
  }

  // Capacity applies only when this call adds a new active registrant (brand
  // new, or a cancelled row reactivating) — skipped for an already-active
  // member (handled above).
  const addsActiveRegistrant = existing == null || existing.cancelled_at !== null
  if (addsActiveRegistrant && event.guest_capacity != null) {
    // Approved role holders are excluded (2608-DEV-710 D10) — see
    // lib/server/event-capacity.ts.
    const attendees = await countAttendeesForCapacity(supabase, eventId)
    if (attendees >= event.guest_capacity) {
      return { success: false, error: CAPACITY_ERROR }
    }
  }

  if (existing) {
    // Reactivate this member's own previously-cancelled row.
    const { error: updateError } = await supabase
      .from('guest_registrations')
      .update({
        status: 'confirmed',
        cancelled_at: null,
        name: profileName,
        share_link_id: shareLinkId ?? existing.share_link_id,
      })
      .eq('id', existing.id)
    if (updateError) return attendWriteError(updateError)

    await creditShareLink(supabase, shareLinkId, profileName)
    const emailed = await sendMemberConfirmation(contactEmail, eventId, event, profileName, lang)
    return { success: true, registrationId: existing.id, emailed }
  }

  // D9 adopt-or-insert: a guest row on this event whose email matches the
  // caller's contact_email is converted in place instead of inserting a
  // second row for the same human. Skipped when contact_email is null.
  // profile_id IS NULL guards against reassigning a row someone else already
  // claimed — matching on email alone would let a caller take over another
  // member's active registration by sharing their contact_email.
  if (contactEmail) {
    const { data: guestRow } = await supabase
      .from('guest_registrations')
      .select('id')
      .eq('event_id', eventId)
      .eq('email', contactEmail)
      .is('profile_id', null)
      .maybeSingle()

    if (guestRow) {
      const { error: adoptError } = await supabase
        .from('guest_registrations')
        .update({
          profile_id: profileId,
          email: null,
          token: null,
          expires_at: null,
          cancelled_at: null,
          status: 'confirmed',
          name: profileName,
          share_link_id: shareLinkId ?? undefined,
        })
        .eq('id', guestRow.id)
      if (adoptError) return attendWriteError(adoptError)

      await creditShareLink(supabase, shareLinkId, profileName)
      const emailed = await sendMemberConfirmation(contactEmail, eventId, event, profileName, lang)
      return { success: true, registrationId: guestRow.id, emailed }
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from('guest_registrations')
    .insert({
      event_id: eventId,
      profile_id: profileId,
      name: profileName,
      status: 'confirmed',
      share_link_id: shareLinkId,
    })
    .select('id')
    .single()
  // `!inserted` with no error is not a capacity refusal — attendWriteError falls
  // through to the generic copy on a null error, which is the right answer.
  if (insertError || !inserted) return attendWriteError(insertError)

  await creditShareLink(supabase, shareLinkId, profileName)
  const emailed = await sendMemberConfirmation(contactEmail, eventId, event, profileName, lang)
  return { success: true, registrationId: inserted.id, emailed }
}

// -- Cancel ---------------------------------------------------------------------
// Soft-cancel only, idempotent — matches
// lib/actions/guest-registration.ts cancelGuestRegistration. Deliberately no
// end_time check (unlike attendEvent): cancelling attendance to an event that
// already happened is a legitimate "actually I didn't go" correction, not an
// action that needs blocking.

export type CancelMemberResult =
  | { success: true }
  | { success: false; error: string }

export async function cancelMemberRegistration(
  supabase: SupabaseClient,
  params: { eventId: string; profileId: string }
): Promise<CancelMemberResult> {
  const { eventId, profileId } = params

  const { data: reg } = await supabase
    .from('guest_registrations')
    .select('id, name, share_link_id, cancelled_at')
    .eq('event_id', eventId)
    .eq('profile_id', profileId)
    .maybeSingle()

  if (!reg) return { success: false, error: 'Not registered for this event.' }
  if (reg.cancelled_at != null) return { success: true }

  const { error } = await supabase
    .from('guest_registrations')
    .update({ cancelled_at: new Date().toISOString() })
    .eq('id', reg.id)
    .is('cancelled_at', null)

  if (error) return { success: false, error: 'Could not cancel. Please try again.' }

  if (reg.share_link_id) notifySharerOfCancellation(reg.share_link_id, reg.name ?? 'A member')

  return { success: true }
}
