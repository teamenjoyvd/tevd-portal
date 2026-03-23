'use client'

import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { formatDate, formatCurrency } from '@/lib/format'
import { useLanguage } from '@/lib/hooks/useLanguage'
import RegisterButton from '@/components/trips/RegisterButton'
import type { Tables } from '@/types/supabase'
import type { TripState, TripProfile } from './page'

type Trip = Tables<'trips'>
type Registration = Tables<'trip_registrations'>
type Milestone = { label: string; amount: number; due_date: string }

interface TripDetailClientProps {
  trip: Trip
  state: TripState
  registration: Registration | null
  profile: TripProfile
}

function BackButton() {
  const router = useRouter()
  const { t } = useLanguage()
  return (
    <button
      onClick={() => router.push('/trips')}
      className="flex items-center gap-1.5 text-sm font-medium mb-6 hover:opacity-70 transition-opacity"
      style={{ color: 'var(--text-secondary)' }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      {t('trips.back')}
    </button>
  )
}

function TripHero({ trip, profile }: { trip: Trip; profile: TripProfile }) {
  const { t } = useLanguage()
  const milestones: Milestone[] = Array.isArray(trip.milestones)
    ? (trip.milestones as Milestone[])
    : []
  const days = Math.round(
    (new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / 86400000
  )

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
    >
      {trip.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={trip.image_url} alt="" aria-hidden="true"
          className="w-full object-cover" style={{ height: 240 }} />
      )}
      <div className="px-6 pt-6 pb-8">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'var(--brand-forest)', color: 'rgba(255,255,255,0.85)' }}>
                {trip.destination}
              </span>
              {trip.trip_type && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--brand-teal)', color: 'rgba(255,255,255,0.85)' }}>
                  {trip.trip_type}
                </span>
              )}
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {days} day{days !== 1 ? 's' : ''}
              </span>
            </div>
            <h1 className="font-display text-2xl font-semibold leading-snug"
              style={{ color: 'var(--text-primary)' }}>
              {trip.title}
            </h1>
          </div>
          {profile.role !== 'guest' && (
            <div className="text-right flex-shrink-0">
              <p className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatCurrency(trip.total_cost)}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('trips.total')}</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="4" rx="2" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
          </svg>
          {formatDate(trip.start_date)} – {formatDate(trip.end_date)}
        </div>

        {trip.description && (
          <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
            {trip.description}
          </p>
        )}

        {trip.location && (
          <div className="flex items-center gap-1.5 text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {trip.location}
          </div>
        )}

        {trip.accommodation_type && (
          <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
            <span className="font-medium">{t('trips.accommodation')}</span>{' '}{trip.accommodation_type}
          </p>
        )}

        {trip.inclusions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-5">
            {trip.inclusions.map((inc, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                {inc}
              </span>
            ))}
          </div>
        )}

        {profile.role !== 'guest' && milestones.length > 0 && (
          <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-default)' }}>
            <p className="text-xs font-semibold tracking-widest uppercase mb-3"
              style={{ color: 'var(--text-secondary)' }}>
              {t('trips.milestones')}
            </p>
            <div className="space-y-2">
              {milestones.map((m, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0"
                  style={{ borderColor: 'var(--border-default)' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{m.label}</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {t('trips.due')} {formatDate(m.due_date)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {formatCurrency(m.amount)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── SEQ224: LOCKED state ─────────────────────────────────────────────────────

function LockedView({ profile }: { profile: TripProfile }) {
  const router = useRouter()
  const docLabel = profile.document_active_type === 'passport' ? 'Passport' : 'ID Card'
  const expiryText = profile.valid_through
    ? `expires ${formatDate(profile.valid_through)}`
    : 'no expiry date on file'

  return (
    <div className="py-8 pb-16">
      <div className="max-w-[720px] mx-auto px-4">
        <BackButton />
        <div
          className="rounded-2xl px-6 py-8"
          style={{ backgroundColor: 'rgba(188,71,73,0.08)', border: '1px solid rgba(188,71,73,0.25)' }}
        >
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-0.5">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="#bc4749" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" x2="12" y1="8" y2="12" />
                <line x1="12" x2="12.01" y1="16" y2="16" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold mb-1" style={{ color: '#bc4749' }}>
                Action Required: Update Travel Documents
              </p>
              <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
                Your {docLabel} ({expiryText}) must be valid for at least 90 days to register for a trip.
                Update your documents in your profile to unlock trip registration.
              </p>
              <button
                onClick={() => router.push('/profile')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: '#bc4749' }}
              >
                Go to Profile
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── SEQ224: AVAILABLE state ──────────────────────────────────────────────────

function AvailableView({ trip, profile }: { trip: Trip; profile: TripProfile }) {
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

// ── SEQ225: PENDING state ────────────────────────────────────────────────────

function PendingView({
  trip,
  profile,
  registration,
}: {
  trip: Trip
  profile: TripProfile
  registration: Registration
}) {
  const router = useRouter()

  const cancelMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/profile/trips/${trip.id}/cancel`, { method: 'POST' }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? 'Cancel failed')
        return r.json()
      }),
    onSuccess: () => router.push('/trips'),
  })

  // Defensive: if cancelled_at is set, registration should not be in pending state
  // but guard anyway to avoid showing cancel UI for an already-cancelled registration
  if (registration.cancelled_at) {
    return (
      <div className="py-8 pb-16">
        <div className="max-w-[720px] mx-auto px-4">
          <BackButton />
          <TripHero trip={trip} profile={profile} />
          <div className="mt-4 rounded-2xl px-6 py-5"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Registration cancelled on {formatDate(registration.cancelled_at)}.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="py-8 pb-16">
      <div className="max-w-[720px] mx-auto px-4">
        <BackButton />
        <TripHero trip={trip} profile={profile} />
        <div className="mt-4 rounded-2xl px-6 py-6"
          style={{ backgroundColor: 'rgba(180,138,60,0.08)', border: '1px solid rgba(180,138,60,0.25)' }}>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-0.5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="#b48a3c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold mb-1" style={{ color: '#b48a3c' }}>
                Registration Pending
              </p>
              <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
                Your registration request is awaiting admin approval.
              </p>
              <button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50 transition-opacity hover:opacity-80"
                style={{ backgroundColor: 'var(--border-default)', color: 'var(--text-primary)' }}
              >
                {cancelMutation.isPending ? 'Cancelling…' : 'Cancel Registration'}
              </button>
              {cancelMutation.isError && (
                <p className="text-xs mt-2" style={{ color: '#bc4749' }}>
                  {(cancelMutation.error as Error).message}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Placeholder for states handled by later tickets ──────────────────────────

function PlaceholderView({ state, trip, profile }: { state: TripState; trip: Trip; profile: TripProfile }) {
  return (
    <div className="py-8 pb-16">
      <div className="max-w-[720px] mx-auto px-4">
        <BackButton />
        <TripHero trip={trip} profile={profile} />
      </div>
    </div>
  )
}

// ── Root export ──────────────────────────────────────────────────────────────

function TripDetailContent({
  trip,
  state,
  registration,
  profile,
}: TripDetailClientProps) {
  if (state === 'locked') return <LockedView profile={profile} />
  if (state === 'available') return <AvailableView trip={trip} profile={profile} />
  if (state === 'pending' && registration)
    return <PendingView trip={trip} profile={profile} registration={registration} />
  return <PlaceholderView state={state} trip={trip} profile={profile} />
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
