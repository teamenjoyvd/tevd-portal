import { createServiceClient } from '@/lib/supabase/service'
import { requireAuth, withProfile } from '@/lib/supabase/with-profile'
import type { Tables } from '@/types/supabase'

// Explicit column list — never '*'. Every field here is read by at least one
// ['profile'] react-query consumer (audited 2607-DEV-604): UserDropdown,
// TripsClient, ProfileTile (role/first_name/last_name/display_names/verRequest/upline),
// TravelDocContent (document_active_type/id_number/passport_number/valid_through),
// PersonalDetailsContent (first_name/last_name/display_names/phone/contact_email),
// AboInfoContent (role/abo_number/upline/verRequest/spouse/pendingSpouseLinkCount/primary_profile_id),
// CalendarSection + ProfileClient (ui_prefs), EmailPrefsSection (notification_prefs).
// clerk_id and created_at are intentionally excluded — no consumer reads them.
const PROFILE_SELECT =
  'id, first_name, last_name, display_names, phone, contact_email, role, ' +
  'abo_number, upline_abo_number, primary_profile_id, document_active_type, ' +
  'id_number, passport_number, valid_through, ui_prefs, notification_prefs'

type ProfileSelection = Pick<
  Tables<'profiles'>,
  | 'id' | 'first_name' | 'last_name' | 'display_names' | 'phone' | 'contact_email'
  | 'role' | 'abo_number' | 'upline_abo_number' | 'primary_profile_id'
  | 'document_active_type' | 'id_number' | 'passport_number' | 'valid_through'
  | 'ui_prefs' | 'notification_prefs'
>

export async function GET() {
  const ctx = await withProfile<ProfileSelection>(PROFILE_SELECT)
  if (ctx.response) return ctx.response
  const { supabase, error } = ctx

  if (error) {
    // PGRST116 = no rows returned — user has no profile yet (webhook not fired)
    if (error.code === 'PGRST116') {
      return Response.json({ error: 'Profile not found' }, { status: 404 })
    }
    return Response.json({ error: error.message }, { status: 500 })
  }
  const data = ctx.profile!

  // Extract scalars before Promise.all — TS cannot narrow property accesses
  // through IIFE closure boundaries, so we capture as typed consts here.
  const aboNumber: string | null = data.abo_number
  const uplineAboNumber: string | null = data.upline_abo_number ?? null
  const profileId: string = data.id
  const role: string = data.role
  const primaryProfileId: string | null = data.primary_profile_id ?? null

  // Spouse-linked secondary profiles (primary_profile_id set) intentionally have
  // null abo_number/upline_abo_number — the primary profile holds the shared ABO
  // account (ADR-016), so it can't also live on the secondary's row without
  // tripping the abo_partnership_unique_constraint. Resolve the primary once here
  // so the upline lookup and the abo_number/upline_abo_number returned to the
  // client reflect the shared account instead of showing blank.
  let primaryInfo: {
    id: string
    first_name: string
    last_name: string
    abo_number: string | null
    upline_abo_number: string | null
  } | null = null
  if (primaryProfileId) {
    const { data: primary, error: primaryError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, abo_number, upline_abo_number')
      .eq('id', primaryProfileId)
      .maybeSingle()
    if (primaryError) {
      return Response.json({ error: primaryError.message }, { status: 500 })
    }
    primaryInfo = primary ?? null
  }

  const effectiveAboNumber: string | null = aboNumber ?? primaryInfo?.abo_number ?? null
  const effectiveUplineAboNumber: string | null = uplineAboNumber ?? primaryInfo?.upline_abo_number ?? null

  const [upline, verRequest, spouse, pendingSpouseLinkCount] = await Promise.all([
    // Resolve upline for any verified member (own account, or via the primary
    // profile's shared ABO when this is a spouse-linked secondary).
    // Standard path: abo_number set — look up sponsor via los_members tree.
    // Manual path: abo_number null but upline_abo_number set — resolve name directly.
    effectiveAboNumber
      ? (async () => {
          const { data: losMember } = await supabase
            .from('los_members')
            .select('sponsor_abo_number')
            .eq('abo_number', effectiveAboNumber)
            .single()

          if (!losMember?.sponsor_abo_number) {
            return { upline_name: null, upline_abo_number: null }
          }

          const { data: uplineMember } = await supabase
            .from('los_members')
            .select('abo_number, name')
            .eq('abo_number', losMember.sponsor_abo_number)
            .single()

          return {
            upline_name: uplineMember?.name ?? null,
            upline_abo_number: uplineMember?.abo_number ?? null,
          }
        })()
      : effectiveUplineAboNumber
        ? (async () => {
            // Manual path: upline ABO already known, just resolve the name
            const { data: uplineMember } = await supabase
              .from('los_members')
              .select('abo_number, name')
              .eq('abo_number', effectiveUplineAboNumber)
              .single()

            return {
              upline_name: uplineMember?.name ?? null,
              upline_abo_number: uplineMember?.abo_number ?? effectiveUplineAboNumber,
            }
          })()
        : Promise.resolve(null),
    role === 'guest'
      ? (async () => {
          const { data: req } = await supabase
            .from('abo_verification_requests')
            .select('id, claimed_abo, claimed_upline_abo, status, admin_note, created_at, request_type')
            .eq('profile_id', profileId)
            .maybeSingle()
          return req ?? null
        })()
      : Promise.resolve(null),
    // Spouse: primary fetches their secondary; secondary fetches their primary.
    // Returns null for unlinked profiles.
    (async () => {
      if (primaryProfileId) {
        // This profile is a secondary — reuse the primary fetched above
        return primaryInfo
          ? { id: primaryInfo.id, first_name: primaryInfo.first_name, last_name: primaryInfo.last_name }
          : null
      } else {
        // This profile may be a primary — fetch any secondary linked to it
        const { data: secondary } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .eq('primary_profile_id', profileId)
          .maybeSingle()
        return secondary ?? null
      }
    })(),
    // Pending inbound spouse link requests — only relevant for primary members
    // (non-guest, no primary_profile_id). Guests and secondaries always get 0.
    role !== 'guest' && !primaryProfileId
      ? (async () => {
          const { count } = await supabase
            .from('spouse_link_requests')
            .select('id', { count: 'exact', head: true })
            .eq('claimed_primary_id', profileId)
            .eq('status', 'pending')
          return count ?? 0
        })()
      : Promise.resolve(0),
  ])

  return Response.json({
    ...data,
    abo_number: effectiveAboNumber,
    upline_abo_number: effectiveUplineAboNumber,
    upline,
    verRequest,
    spouse,
    pendingSpouseLinkCount,
  })
}

export async function PATCH(req: Request): Promise<Response> {
  const authCtx = await requireAuth()
  if (authCtx.response) return authCtx.response
  const { userId } = authCtx

  const supabase = createServiceClient()
  const body = await req.json() as Record<string, unknown>

  // Whitelist updatable fields — clerk_id, role, abo_number not patchable here
  const allowed = [
    'first_name', 'last_name', 'display_names',
    'document_active_type',
    'id_number', 'passport_number', 'valid_through',
    'phone', 'contact_email',
    'ui_prefs',
    'notification_prefs',
  ]
  const patch = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  )

  // ui_prefs must be merged, not replaced — callers send partial shapes
  // (e.g. { font_size: 'lg' }) and must not clobber bento_order / bento_collapsed.
  if (patch.ui_prefs !== undefined) {
    const { data: existing, error: fetchError } = await supabase
      .from('profiles')
      .select('ui_prefs')
      .eq('clerk_id', userId)
      .single()

    if (fetchError) return Response.json({ error: fetchError.message }, { status: 500 })

    patch.ui_prefs = {
      ...(existing?.ui_prefs as Record<string, unknown> ?? {}),
      ...(patch.ui_prefs as Record<string, unknown>),
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('clerk_id', userId)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
