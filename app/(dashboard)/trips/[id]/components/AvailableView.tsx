'use client'

import { useState } from 'react'
import RegisterButton from '@/components/trips/RegisterButton'
import { BackButton, TripHeroImage, TripDetail, FALLBACK_ACCENT } from './shared'
import type { Tables } from '@/types/supabase'
import type { TripProfile } from '../page'

type Trip = Tables<'trips'>

export function AvailableView({
  trip,
  profile,
}: {
  trip: Trip
  profile: TripProfile
}) {
  const [accentColor, setAccentColor] = useState(FALLBACK_ACCENT)

  return (
    <div className="py-8 pb-16">
      <div className="max-w-4xl mx-auto px-4 space-y-4">
        <BackButton />
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
          <TripHeroImage trip={trip} onAccentColor={setAccentColor} />
          <TripDetail trip={trip} profile={profile} accentColor={accentColor} />
        </div>
        <RegisterButton tripId={trip.id} profileId={profile.id} />
      </div>
    </div>
  )
}
