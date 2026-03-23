import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { TripDetailClient } from './TripDetailClient'
import type { Tables } from '@/types/supabase'

export type TripState = 'locked' | 'available' | 'pending' | 'attendee' | 'archived'

type Trip = Tables<'trips'>
type Profile = Pick<Tables<'profiles'>, 'id' | 'role' | 'valid_through'>
type Registration = Tables<'trip_registrations'>

function deriveTripState(
  trip: Trip,
  profile: Profile,
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

  const [{ data: profile }, { data: trip }, { data: registration }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, role, valid_through')
        .eq('clerk_id', userId)
        .single(),
      supabase.from('trips').select('*').eq('id', id).single(),
      supabase
        .from('trip_registrations')
        .select('*')
        .eq('trip_id', id)
        .eq('profile_id',
          // profile_id resolved below after profile fetch completes
          // We re-query after profile is known
          '00000000-0000-0000-0000-000000000000'
        )
        .maybeSingle(),
    ])

  if (!profile || !trip) redirect('/trips')

  // Re-fetch registration scoped to the real profile id
  const { data: scopedRegistration } = await supabase
    .from('trip_registrations')
    .select('*')
    .eq('trip_id', id)
    .eq('profile_id', profile.id)
    .maybeSingle()

  const state = deriveTripState(trip, profile, scopedRegistration ?? null)

  return (
    <TripDetailClient
      trip={trip}
      state={state}
      registration={scopedRegistration ?? null}
      profile={profile}
    />
  )
}
