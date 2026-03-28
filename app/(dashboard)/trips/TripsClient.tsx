'use client'

import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@clerk/nextjs'
import { useLanguage } from '@/lib/hooks/useLanguage'
import RegisterButton from '@/components/trips/RegisterButton'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatDate, formatCurrency } from '@/lib/format'
import type { Trip } from './page'

// Shape returned by GET /api/profile/payments
type ProfilePaymentRow = {
  registration_id: string
  registration_status: 'pending' | 'approved' | 'denied'
  registered_at: string
  cancelled_at: string | null
  trip: { id: string } | null
  payments: unknown[]
}

type UserProfile = { id: string; role: string }

function StatusBadge({ status, onCancel, isCancelling, t }: {
  status: 'pending' | 'approved' | 'denied'
  onCancel?: () => void
  isCancelling?: boolean
  t: (key: Parameters<ReturnType<typeof useLanguage>['t']>[0]) => string
}) {
  const STATUS_STYLES = {
    pending:  { bg: '#f2cc8f33', color: '#7a5c00', label: t('trips.status.pending')  },
    approved: { bg: '#81b29a33', color: '#2d6a4f', label: t('trips.status.approved') },
    denied:   { bg: '#bc474920', color: '#bc4749', label: t('trips.status.denied')   },
  } as const

  const style = STATUS_STYLES[status]
  return (
    <div
      className="px-4 py-2.5 rounded-xl flex items-center justify-between"
      style={{ backgroundColor: style.bg }}
    >
      <p className="text-sm font-medium" style={{ color: style.color }}>{style.label}</p>
      {status === 'pending' && onCancel && (
        <button
          onClick={onCancel}
          disabled={isCancelling}
          className="text-xs font-medium disabled:opacity-50"
          style={{ color: style.color }}
        >
          {t('trips.cancel')}
        </button>
      )}
    </div>
  )
}

function TripCard({
  trip,
  registrationStatus,
  isCancelled,
  regLoading,
  profileId,
  onCancel,
  isCancelling,
  t,
  userRole,
}: {
  trip: Trip
  registrationStatus: 'pending' | 'approved' | 'denied' | undefined
  isCancelled: boolean
  regLoading: boolean
  profileId: string | null
  onCancel: (tripId: string) => void
  isCancelling: boolean
  t: (key: Parameters<ReturnType<typeof useLanguage>['t']>[0]) => string
  userRole: string
}) {
  const router = useRouter()
  const isRegistered = !!registrationStatus && registrationStatus !== 'denied' && !isCancelled

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col h-full"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
    >
      {trip.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={trip.image_url}
          alt=""
          aria-hidden="true"
          className="w-full object-cover flex-shrink-0"
          style={{ height: 140 }}
        />
      )}

      <div className="px-5 pt-4 pb-5 flex flex-col gap-3 flex-1">
        {/* Title row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'var(--brand-forest)', color: 'rgba(255,255,255,0.85)' }}
              >
                {trip.destination}
              </span>
              {trip.trip_type && (
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--brand-teal)', color: 'rgba(255,255,255,0.85)' }}
                >
                  {trip.trip_type}
                </span>
              )}
            </div>
            <h3
              className="font-display text-lg font-semibold leading-snug"
              style={{ color: 'var(--text-primary)' }}
            >
              {trip.title}
            </h3>
          </div>
          {userRole !== 'guest' && (
            <div className="text-right flex-shrink-0">
              <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatCurrency(trip.total_cost)}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('trips.total')}</p>
            </div>
          )}
        </div>

        {/* Dates */}
        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="4" rx="2" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
          </svg>
          {formatDate(trip.start_date)} – {formatDate(trip.end_date)}
        </div>

        {/* Registration status or CTA — always at bottom, no layout shift */}
        <div className="mt-auto flex flex-col gap-2">
          {regLoading && userRole !== 'guest' ? (
            // Placeholder holds the space while registration data loads — prevents shift
            <Skeleton className="rounded-xl" style={{ height: 44 }} />
          ) : isRegistered && registrationStatus ? (
            <>
              <StatusBadge
                status={registrationStatus}
                onCancel={() => onCancel(trip.id)}
                isCancelling={isCancelling}
                t={t}
              />
              <button
                onClick={() => router.push(`/trips/${trip.id}`)}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white hover:opacity-90 active:opacity-70 transition-opacity"
                style={{ backgroundColor: 'var(--brand-forest)' }}
              >
                {t('trips.viewDetails')}
              </button>
            </>
          ) : userRole === 'guest' ? (
            <p
              className="text-xs text-center py-2 rounded-xl"
              style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--border-default)' }}
            >
              {t('trips.memberOnly')}
            </p>
          ) : (
            <RegisterButton tripId={trip.id} profileId={profileId} />
          )}
        </div>
      </div>
    </div>
  )
}

export default function TripsClient({ initialTrips }: { initialTrips: Trip[] }) {
  const { isSignedIn, isLoaded } = useUser()
  const qc = useQueryClient()
  const { t } = useLanguage()

  const { data: profile } = useQuery<UserProfile>({
    queryKey: ['profile'],
    queryFn: () => fetch('/api/profile').then(r => r.json()),
    enabled: !!isSignedIn,
  })

  // Hydrate TanStack cache with server-prefetched trips so no client fetch needed on first render.
  // Signed-in users may get a stale role-filtered list; the refetch below corrects it silently.
  const { data: trips = initialTrips } = useQuery<Trip[]>({
    queryKey: ['trips'],
    queryFn: () => fetch('/api/trips').then(r => r.json()),
    initialData: initialTrips,
    // Re-fetch in background once auth is resolved so role-filtered results are fresh
    enabled: isLoaded,
    staleTime: 30_000,
  })

  // profile-payments: fetch as soon as the user is signed in — no longer gated on profile.id
  // The API resolves the profile server-side from the session cookie.
  const { data: profilePayments = [], isLoading: regLoading } = useQuery<ProfilePaymentRow[]>({
    queryKey: ['profile-payments'],
    queryFn: () => fetch('/api/profile/payments').then(r => r.json()),
    enabled: !!isSignedIn,
  })

  const regByTripId = Object.fromEntries(
    profilePayments
      .filter(row => row.trip !== null)
      .map(row => [row.trip!.id, row])
  )

  const cancelMutation = useMutation({
    mutationFn: (tripId: string) =>
      fetch(`/api/profile/trips/${tripId}/cancel`, { method: 'POST' }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile-payments'] }),
  })

  const userRole = profile?.role ?? (isSignedIn ? undefined : 'guest')

  return (
    <div className="py-8 pb-16">
      <div className="max-w-[860px] mx-auto px-4 sm:px-6 xl:px-8">

        {/* Mobile: single-column stack */}
        <div className="md:hidden flex flex-col gap-3">
          {trips.length === 0 ? (
            <div
              className="rounded-2xl flex flex-col items-center justify-center py-16"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                className="mb-4">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
              </svg>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{t('trips.noTrips')}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{t('trips.noTripsDesc')}</p>
            </div>
          ) : (
            trips.map(trip => {
              const row = regByTripId[trip.id]
              return (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  registrationStatus={row?.registration_status}
                  isCancelled={!!row?.cancelled_at}
                  regLoading={regLoading && !!isSignedIn}
                  profileId={profile?.id ?? null}
                  onCancel={id => cancelMutation.mutate(id)}
                  isCancelling={cancelMutation.isPending}
                  t={t}
                  userRole={userRole ?? 'guest'}
                />
              )
            })
          )}
        </div>

        {/* Desktop: 2-up grid */}
        <div
          className="hidden md:grid"
          style={{
            gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
            gap: '12px',
          }}
        >
          {trips.length === 0 ? (
            <div
              style={{
                gridColumn: 'span 12',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
              }}
              className="rounded-2xl flex flex-col items-center justify-center py-16"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                className="mb-4">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
              </svg>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{t('trips.noTrips')}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{t('trips.noTripsDesc')}</p>
            </div>
          ) : (
            trips.map(trip => {
              const row = regByTripId[trip.id]
              return (
                <div key={trip.id} style={{ gridColumn: 'span 6' }}>
                  <TripCard
                    trip={trip}
                    registrationStatus={row?.registration_status}
                    isCancelled={!!row?.cancelled_at}
                    regLoading={regLoading && !!isSignedIn}
                    profileId={profile?.id ?? null}
                    onCancel={id => cancelMutation.mutate(id)}
                    isCancelling={cancelMutation.isPending}
                    t={t}
                    userRole={userRole ?? 'guest'}
                  />
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
