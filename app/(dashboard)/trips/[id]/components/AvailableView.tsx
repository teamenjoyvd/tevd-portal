'use client'

import RegisterButton from '@/components/trips/RegisterButton'
import { BackButton, TripHero } from './shared'
import type { Tables } from '@/types/supabase'
import type { TripProfile } from '../page'

type Trip = Tables<'trips'>

export function AvailableView({
  trip,
  profile,
  desktopActionSlot,
}: {
  trip: Trip
  profile: TripProfile
  desktopActionSlot?: boolean
}) {
  // Desktop: action panel only (TripHero rendered in left column by TripDetailClient)
  if (desktopActionSlot) {
    return (
      <div className="rounded-2xl px-6 py-6 space-y-4"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <p className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--text-secondary)' }}>
          Register
        </p>
        <RegisterButton tripId={trip.id} profileId={profile.id} />
      </div>
    )
  }

  // Mobile: full single-column layout
  return (
    <div className="py-8 pb-16">
      <div className="max-w-[720px] mx-auto px-4">
        <BackButton />
        <TripHero trip={trip} profile={profile} />
        <div className="mt-4">
          <RegisterButton tripId={trip.id} profileId={profile.id} />
        </div>
      </div>
    </div>
  )
}
