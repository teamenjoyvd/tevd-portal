'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { Drawer } from '@/components/ui/drawer'
import { type TripEntry, VARIABLE_CAP } from '../types'
import { TripRow, ShowMoreButton } from './shared'
import { apiClient } from '@/lib/apiClient'

export const TRIPS_MIN_HEIGHT = 280

export function TripsSection({ profileId, role }: { profileId: string; role: string }) {
  const { t } = useLanguage()
  const qc = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const { data: tripsData, isLoading } = useQuery<TripEntry[]>({
    queryKey: ['profile-trips'],
    queryFn: () => apiClient('/api/profile/payments'),
    enabled: !!profileId && role !== 'guest',
    staleTime: 2 * 60 * 1000,
  })

  const cancelTrip = useMutation({
    mutationFn: (tripId: string) =>
      apiClient(`/api/profile/trips/${tripId}/cancel`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile-trips'] }),
  })

  const handleCancel = useCallback((tripId: string) => { cancelTrip.mutate(tripId) }, [cancelTrip])

  if (isLoading) {
    return <div className="rounded-2xl animate-pulse h-full" style={{ backgroundColor: 'var(--border-default)' }} />
  }

  const trips = tripsData ?? []
  const visible = trips.slice(0, VARIABLE_CAP)
  const overflow = trips.length - VARIABLE_CAP

  return (
    <>
      <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-4 pr-16" style={{ color: 'var(--brand-crimson)' }}>{t('profile.trips')}</p>
        <div className="space-y-2">
          {visible.map(entry => (
            <TripRow key={entry.registration_id} entry={entry} onCancel={handleCancel} cancelPending={cancelTrip.isPending} />
          ))}
        </div>
        {overflow > 0 && <ShowMoreButton count={overflow} onClick={() => setDrawerOpen(true)} />}
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={t('profile.allTrips')}>
        <div className="space-y-2">
          {trips.map(entry => (
            <TripRow key={entry.registration_id} entry={entry} onCancel={handleCancel} cancelPending={cancelTrip.isPending} />
          ))}
        </div>
      </Drawer>
    </>
  )
}
