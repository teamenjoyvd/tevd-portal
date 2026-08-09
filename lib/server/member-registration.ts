import type { SupabaseClient } from '@supabase/supabase-js'
import { notifySharerOfRegistration, notifySharerOfCancellation } from '@/lib/notifications/share-events'

// -- Attend -------------------------------------------------------------------
// D1 one-tap attend + D9 adopt-don't-duplicate, for an authenticated member.
// Mirrors lib/actions/guest-registration.ts step for step, with three
// deliberate differences: no self-attribution, no consumeRegistrationSlot
// (authenticated + idempotent under the unique index covers the abuse case
// consumeRegistrationSlot exists for), and adopt-or-insert instead of a bare
// upsert.

export type AttendMemberResult =
  | { success: true; registrationId: string }
  | { success: false; error: string }

export type AttendMemberParams = {
  eventId: string
  profileId: string
  profileRole: string
  profileName: string
  contactEmail: string | null
  shareToken?: string
}

export async function attendEvent(
  supabase: SupabaseClient,
  params: AttendMemberParams
): Promise<AttendMemberResult> {
  const { eventId, profileId, profileRole, profileName, contactEmail, shareToken } = params

  if (profileRole === 'guest') return { success: false, error: 'Guests cannot use member attend.' }

  const { data: event, error: eventError } = await supabase
    .from('calendar_events')
    .select('id, allow_guest_registration, end_time, guest_capacity')
    .eq('id', eventId)
    .single()

  if (eventError || !event)            return { success: false, error: 'Event not found.' }
  if (!event.allow_guest_registration) return { success: false, error: 'Registration is not available for this event.' }
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
    return { success: true, registrationId: existing.id }
  }

  // Capacity applies only when this call adds a new active registrant (brand
  // new, or a cancelled row reactivating) — skipped for an already-active
  // member (handled above).
  const addsActiveRegistrant = existing == null || existing.cancelled_at !== null
  if (addsActiveRegistrant && event.guest_capacity != null) {
    const { count } = await supabase
      .from('guest_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .is('cancelled_at', null)
    if ((count ?? 0) >= event.guest_capacity) {
      return { success: false, error: 'This event has reached its guest capacity.' }
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
    if (updateError) return { success: false, error: 'Could not attend. Please try again.' }

    if (shareLinkId) await supabase.rpc('increment_share_link_click', { link_id: shareLinkId })
    if (shareLinkId) notifySharerOfRegistration(shareLinkId, profileName)
    return { success: true, registrationId: existing.id }
  }

  // D9 adopt-or-insert: a guest row on this event whose email matches the
  // caller's contact_email is converted in place instead of inserting a
  // second row for the same human. Skipped when contact_email is null.
  if (contactEmail) {
    const { data: guestRow } = await supabase
      .from('guest_registrations')
      .select('id')
      .eq('event_id', eventId)
      .eq('email', contactEmail)
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
      if (adoptError) return { success: false, error: 'Could not attend. Please try again.' }

      if (shareLinkId) await supabase.rpc('increment_share_link_click', { link_id: shareLinkId })
      if (shareLinkId) notifySharerOfRegistration(shareLinkId, profileName)
      return { success: true, registrationId: guestRow.id }
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
  if (insertError || !inserted) return { success: false, error: 'Could not attend. Please try again.' }

  if (shareLinkId) await supabase.rpc('increment_share_link_click', { link_id: shareLinkId })
  if (shareLinkId) notifySharerOfRegistration(shareLinkId, profileName)
  return { success: true, registrationId: inserted.id }
}

// -- Cancel ---------------------------------------------------------------------
// Soft-cancel only, idempotent — matches
// lib/actions/guest-registration.ts cancelGuestRegistration.

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

  if (reg.share_link_id) notifySharerOfCancellation(reg.share_link_id, reg.name)

  return { success: true }
}
