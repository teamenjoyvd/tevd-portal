import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { TripDetailClient } from './TripDetailClient'
import type { Tables } from '@/types/supabase'

export type TripState = 'locked' | 'available' | 'pending' | 'attendee' | 'archived'

type Trip = Tables<'trips'>
export type TripProfile = Pick<
  Tables<'profiles'>,
  'id' | 'role' | 'valid_through' | 'document_active_type'
>
type Registration = Tables<'trip_registrations'>
export type TripPayment = Tables<'payments'>

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
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()

  // Fetch profile first — we need the role for access filtering
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, valid_through, document_active_type')
    .eq('clerk_id', userId)
    .single()

  if (!profile) redirect('/trips')

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
      .select('*')
      .eq('trip_id', id)
      .eq('profile_id', profile.id)
      .order('transaction_date', { ascending: true }),
  ])

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
      payments={payments ?? []}
      profile={profile}
      teamAttendees={teamAttendees}
    />
  )
}
