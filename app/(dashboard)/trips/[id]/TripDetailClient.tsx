'use client'

import { LockedView } from './components/LockedView'
import { AvailableView } from './components/AvailableView'
import { PendingView } from './components/PendingView'
import { AttendeeView } from './components/AttendeeView'
import { ArchivedView } from './components/ArchivedView'
import { BackButton, TripHero } from './components/shared'
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

export function TripDetailClient(props: TripDetailClientProps) {
  const { trip, state, registration, payments, profile, teamAttendees } = props

  // ── States that use single-column on both breakpoints ──────────────────
  if (state === 'locked') {
    return <LockedView trip={trip} profile={profile} />
  }
  if (state === 'pending' && registration) {
    return <PendingView trip={trip} profile={profile} registration={registration} />
  }
  if (state === 'archived') {
    return <ArchivedView trip={trip} profile={profile} payments={payments} />
  }

  // ── attendee: two-column desktop / single-column mobile ──────────────
  if (state === 'attendee') {
    return (
      <>
        {/* Desktop: two-column grid */}
        <div className="hidden md:block py-8 pb-16">
          <div
            className="mx-auto px-4"
            style={{ maxWidth: 1024, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}
          >
            <BackButton />
            <div />
            {/* Left column */}
            <div className="space-y-4">
              <TripHero trip={trip} profile={profile} />
            </div>
            {/* Right column */}
            <div className="space-y-4">
              <AttendeeView
                trip={trip}
                profile={profile}
                payments={payments}
                teamAttendees={teamAttendees}
                desktopActionSlot
              />
            </div>
          </div>
        </div>
        {/* Mobile: single-column stack */}
        <div className="md:hidden">
          <AttendeeView
            trip={trip}
            profile={profile}
            payments={payments}
            teamAttendees={teamAttendees}
          />
        </div>
      </>
    )
  }

  // ── available: two-column desktop / single-column mobile ────────────
  if (state === 'available') {
    return (
      <>
        {/* Desktop: two-column grid */}
        <div className="hidden md:block py-8 pb-16">
          <div
            className="mx-auto px-4"
            style={{ maxWidth: 1024, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}
          >
            <BackButton />
            <div />
            {/* Left column */}
            <div className="space-y-4">
              <TripHero trip={trip} profile={profile} />
            </div>
            {/* Right column */}
            <div className="space-y-4">
              <AvailableView trip={trip} profile={profile} desktopActionSlot />
            </div>
          </div>
        </div>
        {/* Mobile: single-column stack */}
        <div className="md:hidden">
          <AvailableView trip={trip} profile={profile} />
        </div>
      </>
    )
  }

  // Fallback
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
