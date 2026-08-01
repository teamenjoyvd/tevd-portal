import { redirect } from 'next/navigation'
import { loadProfile } from '@/lib/server/ensure-profile'
import { TripDetailClient } from './TripDetailClient'
import { redactForeignProofUrls } from '@/lib/payments/proof'
import type { Tables } from '@/types/supabase'

export type TripState = 'locked' | 'available' | 'pending' | 'attendee' | 'archived'

type Trip = Tables<'trips'>
export type TripProfile = Pick<
  Tables<'profiles'>,
  'id' | 'role' | 'valid_through' | 'document_active_type'
>
type Registration = Tables<'trip_registrations'>

/**
 * A trip payment row plus, when it covers an ad-hoc guest (2607-DEV-677), that
 * guest's name. The row sits on the PAYER's profile_id — a guest has no ledger —
 * so `beneficiary_guest_id` is what separates "money I owe" from "money I paid
 * for someone else"; see the approvedTotal reducers in AttendeeView/ArchivedView.
 */
export type TripPayment = Tables<'payments'> & {
  payment_guests: { id: string; name: string } | null
}

export type TeamAttendee = {
  profile_id: string
  first_name: string
  last_name: string
  role: string
  abo_number: string
}

function deriveTripState(
  trip: Trip,
  profile: TripProfile,
  registration: Registration | null
): TripState {
  const now = new Date()
  const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

  const isLocked =
    !profile.valid_through ||
    new Date(profile.valid_through) < ninetyDaysFromNow

  if (isLocked) return 'locked'

  if (!registration || registration.status === 'denied') return 'available'
  if (registration.status === 'pending') return 'pending'

  // status === 'approved'
  const tripEnd = new Date(trip.end_date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (tripEnd >= today) return 'attendee'
  return 'archived'
}

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // Fetch profile first — we need the role for access filtering. loadProfile
  // self-heals a missing row so a guest browsing a guest-accessible trip isn't
  // bounced to /trips before it can render.
  const { supabase, profile } = await loadProfile<TripProfile>(
    'id, role, valid_through, document_active_type'
  )

  // Enforce access_roles — only return trip if user's role is included
  const { data: trip } = await supabase
    .from('trips')
    .select('*')
    .eq('id', id)
    .contains('access_roles', [profile.role])
    .single()

  if (!trip) redirect('/trips')

  const [{ data: registration }, { data: payments }] = await Promise.all([
    supabase
      .from('trip_registrations')
      .select('*')
      .eq('trip_id', id)
      .eq('profile_id', profile.id)
      .maybeSingle(),
    supabase
      .from('payments')
      // The guest's name is embedded, not filtered out. A guest row genuinely
      // sits on this profile's ledger and the payer really did pay it, so
      // hiding it here would show them less money than they handed over; the
      // correction belongs in the TOTAL, not in the list. Only one FK points at
      // payment_guests, so this embed needs no hint.
      .select('*, payment_guests(id, name)')
      .eq('trip_id', id)
      .eq('profile_id', profile.id)
      .order('transaction_date', { ascending: true }),
  ])

  // `select('*')` on my own rows now includes ones an upline paid for
  // (2607-DEV-676). AttendeeView hides the proof LINK for those, but the path
  // would still ship inside the serialized RSC props — strip it here so it never
  // leaves the server. See lib/payments/proof.ts.
  const visiblePayments = redactForeignProofUrls(payments ?? [], profile.id)

  const state = deriveTripState(trip, profile, registration ?? null)

  let teamAttendees: TeamAttendee[] = []
  if (state === 'attendee') {
    const { data: rpcData } = await supabase.rpc('get_trip_team_attendees', {
      p_trip_id: id,
      p_viewer_profile: profile.id,
    })
    teamAttendees = (rpcData ?? []) as TeamAttendee[]
  }

  return (
    <TripDetailClient
      trip={trip}
      state={state}
      registration={registration ?? null}
      payments={visiblePayments}
      profile={profile}
      teamAttendees={teamAttendees}
    />
  )
}
