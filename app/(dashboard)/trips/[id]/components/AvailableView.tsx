'use client'

import RegisterButton from '@/components/trips/RegisterButton'
import { BackButton, TripHero } from './shared'
import type { Tables } from '@/types/supabase'
import type { TripProfile } from '../page'

type Trip = Tables<'trips'>

export function AvailableView({ trip, profile }: { trip: Trip; profile: TripProfile }) {
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
