'use client'

import { LockedView } from './components/LockedView'
import { AvailableView } from './components/AvailableView'
import { PendingView } from './components/PendingView'
import { AttendeeView } from './components/AttendeeView'
import { ArchivedView } from './components/ArchivedView'
import { BackButton } from './components/shared'
import type { Tables } from '@/types/supabase'
import type { TripState, TripProfile, TripPayment, TeamAttendee } from './page'

type Trip = Tables<'trips'>
type Registration = Tables<'trip_registrations'>

interface TripDetailClientProps {
  trip: Trip
  state: TripState
  registration: Registration | null
  payments: TripPayment[]
  profile: TripProfile
  teamAttendees: TeamAttendee[]
}

function TripDetailContent(props: TripDetailClientProps) {
  const { trip, state, registration, payments, profile, teamAttendees } = props

  if (state === 'locked') return <LockedView profile={profile} />
  if (state === 'available') return <AvailableView trip={trip} profile={profile} />
  if (state === 'pending' && registration)
    return <PendingView trip={trip} profile={profile} registration={registration} />
  if (state === 'attendee')
    return <AttendeeView trip={trip} profile={profile} payments={payments} teamAttendees={teamAttendees} />
  if (state === 'archived')
    return <ArchivedView trip={trip} profile={profile} payments={payments} />

  return (
    <div className="py-8 pb-16">
      <div className="max-w-[720px] mx-auto px-4">
        <BackButton />
        <div className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <div className="px-6 py-8">
            <p style={{ color: 'var(--text-secondary)' }}>Trip details unavailable.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function TripDetailClient(props: TripDetailClientProps) {
  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block">
        <TripDetailContent {...props} />
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        <TripDetailContent {...props} />
      </div>
    </>
  )
}
