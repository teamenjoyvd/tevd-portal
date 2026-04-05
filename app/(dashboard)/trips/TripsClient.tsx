'use client'

import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@clerk/nextjs'
import { useLanguage } from '@/lib/hooks/useLanguage'
import RegisterButton from '@/components/trips/RegisterButton'
import { Skeleton } from '@/components/ui/Skeleton'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { PinIcon } from './components/TripShared'
import TripCardMobile from './components/TripCardMobile'
import TripCardDesktop from './components/TripCardDesktop'
import type { Trip } from './page'

type ProfilePaymentRow = {
  registration_id: string
  registration_status: 'pending' | 'approved' | 'denied'
  registered_at: string
  cancelled_at: string | null
  trip: { id: string } | null
  payments: unknown[]
}

type UserProfile = { id: string; role: string }

export type CardProps = {
  trip: Trip
  registrationStatus: 'pending' | 'approved' | 'denied' | undefined
  isCancelled: boolean
  // authLoading: true while Clerk, profile, or profile-payments is still in
  // flight for a signed-in user. Skeleton is shown until all three settle.
  authLoading: boolean
  profileId: string | null
  onCancel: (tripId: string) => void
  onViewDetails: () => void
  isCancelling: boolean
  t: (key: Parameters<ReturnType<typeof useLanguage>['t']>[0]) => string
  userRole: string
  ctaNode: React.ReactNode
}

function StatusBadge({ status, onCancel, isCancelling, t }: {
  status: 'pending' | 'approved' | 'denied'
  onCancel?: () => void
  isCancelling?: boolean
  t: CardProps['t']
}) {
  const STATUS_STYLES = {
    pending:  { bg: '#f2cc8f33', color: '#7a5c00', label: t('trips.status.pending')  },
    approved: { bg: '#81b29a33', color: '#2d6a4f', label: t('trips.status.approved') },
    denied:   { bg: '#bc474920', color: '#bc4749', label: t('trips.status.denied')   },
  } as const
  const style = STATUS_STYLES[status]
  return (
    <div className="px-4 py-2.5 rounded-xl flex items-center justify-between" style={{ backgroundColor: style.bg }}>
      <p className="text-sm font-medium" style={{ color: style.color }}>{style.label}</p>
      {status === 'pending' && onCancel && (
        <button onClick={onCancel} disabled={isCancelling}
          className="text-xs font-medium disabled:opacity-50" style={{ color: style.color }}>
          {t('trips.cancel')}
        </button>
      )}
    </div>
  )
}

// showRegister: true only when RegisterButton is the active CTA.
type CtaResult = { node: React.ReactNode; showRegister: boolean }
type CtaProps = Omit<CardProps, 'ctaNode'>

// Pure function — no hooks. router.push is received as onViewDetails prop.
function Cta({ trip, registrationStatus, isCancelled, authLoading, profileId, onCancel, onViewDetails, isCancelling, t, userRole }: CtaProps): CtaResult {
  const isRegistered = !!registrationStatus && registrationStatus !== 'denied' && !isCancelled

  if (authLoading) {
    return { node: <Skeleton className="rounded-xl" style={{ height: 44 }} />, showRegister: false }
  }

  if (isRegistered && registrationStatus) {
    // Pending: show the clearer long-form message + cancel
    if (registrationStatus === 'pending') {
      return {
        node: (
          <div className="px-4 py-3 rounded-xl flex items-center justify-between" style={{ backgroundColor: '#f2cc8f33' }}>
            <p className="text-sm font-medium leading-snug" style={{ color: '#7a5c00' }}>
              {t('trips.status.pendingLong')}
            </p>
            <button
              onClick={e => { e.stopPropagation(); onCancel(trip.id) }}
              disabled={isCancelling}
              className="ml-3 text-xs font-medium flex-shrink-0 disabled:opacity-50"
              style={{ color: '#7a5c00' }}
            >
              {t('trips.cancel')}
            </button>
          </div>
        ),
        showRegister: false,
      }
    }

    // Approved or other: status badge + view details
    return {
      node: (
        <>
          <StatusBadge status={registrationStatus} onCancel={() => onCancel(trip.id)} isCancelling={isCancelling} t={t} />
          <button
            onClick={e => { e.stopPropagation(); onViewDetails() }}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white hover:opacity-90 active:opacity-70 transition-opacity"
            style={{ backgroundColor: 'var(--brand-forest)' }}
          >
            {t('trips.viewDetails')}
          </button>
        </>
      ),
      showRegister: false,
    }
  }

  if (userRole === 'guest') {
    return {
      node: (
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="w-full text-xs font-medium py-2.5 rounded-xl transition-opacity hover:opacity-80"
              style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--border-default)' }}
            >
              {t('trips.memberOnly')}
            </button>
          </PopoverTrigger>
          <PopoverContent align="center" style={{ maxWidth: 260, padding: '14px 16px' }}>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('trips.memberOnlyTooltip')}
            </p>
            <a
              href="/profile"
              className="mt-3 block text-center text-xs font-semibold py-2 rounded-xl text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: 'var(--brand-forest)' }}
            >
              Go to Profile →
            </a>
          </PopoverContent>
        </Popover>
      ),
      showRegister: false,
    }
  }

  return {
    node: <RegisterButton tripId={trip.id} profileId={profileId} />,
    showRegister: true,
  }
}

// ── Page shell ───────────────────────────────────────────────────────────────

export default function TripsClient({ initialTrips }: { initialTrips: Trip[] }) {
  const { isSignedIn, isLoaded } = useUser()
  const router = useRouter()
  const qc = useQueryClient()
  const { t } = useLanguage()

  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ['profile'],
    queryFn: () => fetch('/api/profile').then(r => r.json()),
    enabled: !!isSignedIn,
  })

  const { data: trips = initialTrips } = useQuery<Trip[]>({
    queryKey: ['trips'],
    queryFn: () => fetch('/api/trips').then(r => r.json()),
    initialData: initialTrips,
    enabled: isLoaded,
    staleTime: 30_000,
  })

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

  const authLoading = !isLoaded || (!!isSignedIn && (profileLoading || regLoading))

  const cardProps = (trip: Trip): CardProps => {
    const base: CtaProps = {
      trip,
      registrationStatus: regByTripId[trip.id]?.registration_status,
      isCancelled: !!regByTripId[trip.id]?.cancelled_at,
      authLoading,
      profileId: profile?.id ?? null,
      onCancel: (id: string) => cancelMutation.mutate(id),
      onViewDetails: () => router.push(`/trips/${trip.id}`),
      isCancelling: cancelMutation.isPending,
      t,
      userRole: userRole ?? 'guest',
    }
    return { ...base, ctaNode: Cta(base).node }
  }

  const isSingle = trips.length === 1

  const emptyState = (
    <div className="rounded-2xl flex flex-col items-center justify-center py-16"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      <PinIcon size={28} />
      <p className="font-medium mt-4" style={{ color: 'var(--text-primary)' }}>{t('trips.noTrips')}</p>
      <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{t('trips.noTripsDesc')}</p>
    </div>
  )

  return (
    <div className="py-8 pb-16">
      <div className="max-w-[860px] mx-auto px-4 sm:px-6 xl:px-8">

        {/* Mobile */}
        <div className="md:hidden flex flex-col gap-3">
          {trips.length === 0 ? emptyState : trips.map(trip => (
            <TripCardMobile key={trip.id} {...cardProps(trip)} />
          ))}
        </div>

        {/* Desktop */}
        <div className="hidden md:block">
          {trips.length === 0 ? emptyState : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: '12px' }}>
              {trips.map(trip => (
                <div key={trip.id} style={{ gridColumn: isSingle ? '3 / span 8' : 'span 6' }}>
                  <TripCardDesktop {...cardProps(trip)} />
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
