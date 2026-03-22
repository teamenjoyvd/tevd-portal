'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@clerk/nextjs'
import { useLanguage } from '@/lib/hooks/useLanguage'
import RegisterButton from '@/components/trips/RegisterButton'
import { formatDate, formatCurrency } from '@/lib/format'

type Milestone = { label: string; amount: number; due_date: string }

type Trip = {
  id: string
  title: string
  destination: string
  description: string
  image_url: string | null
  start_date: string
  end_date: string
  currency: 'EUR'
  total_cost: number
  milestones: Milestone[]
  visibility_roles: string[]
  location: string | null
  accommodation_type: string | null
  inclusions: string[]
  trip_type: string | null
}

type Registration = {
  id: string
  trip_id: string
  profile_id: string
  status: 'pending' | 'approved' | 'denied'
  created_at: string
}

type Payment = {
  id: string
  trip_id: string
  amount: number
  transaction_date: string
  status: 'completed' | 'pending' | 'failed'
  note: string | null
}

type UserProfile = { id: string; role: string }

function tripDuration(start: string, end: string) {
  const days = Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 86400000
  )
  return `${days} day${days !== 1 ? 's' : ''}`
}

function TripCard({
  trip, registration, payments, profileId, onCancel, isCancelling, t, userRole,
}: {
  trip: Trip
  registration: Registration | undefined
  payments: Payment[]
  profileId: string | null
  onCancel: (registrationId: string) => void
  isCancelling: boolean
  t: (key: Parameters<ReturnType<typeof useLanguage>['t']>[0]) => string
  userRole: string
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const myPayments = payments.filter(p => p.trip_id === trip.id)
  const totalPaid = myPayments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0)
  const milestones: Milestone[] = Array.isArray(trip.milestones) ? trip.milestones : []

  const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
    pending:  { bg: '#f2cc8f33', color: '#7a5c00', label: t('trips.status.pending')  },
    approved: { bg: '#81b29a33', color: '#2d6a4f', label: t('trips.status.approved') },
    denied:   { bg: '#bc474920', color: '#bc4749', label: t('trips.status.denied')   },
  }

  // A user is "registered" when they have a non-denied registration row
  const isRegistered = !!registration && registration.status !== 'denied'

  return (
    <div className="h-full rounded-2xl overflow-hidden flex flex-col transition-shadow duration-150 hover:shadow-sm" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      {trip.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={trip.image_url}
          alt=""
          aria-hidden="true"
          className="w-full object-cover flex-shrink-0"
          style={{ height: 160 }}
        />
      )}
      <div className="px-5 pt-5 pb-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'var(--brand-forest)', color: 'rgba(255,255,255,0.85)' }}
              >
                {trip.destination}
              </span>
              {trip.trip_type && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--brand-teal)', color: 'rgba(255,255,255,0.85)' }}>
                  {trip.trip_type}
                </span>
              )}
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {tripDuration(trip.start_date, trip.end_date)}
              </span>
            </div>
            <h3 className="font-display text-xl font-semibold leading-snug"
              style={{ color: 'var(--text-primary)' }}>
              {trip.title}
            </h3>
          </div>
          {userRole !== 'guest' && (
            <div className="text-right flex-shrink-0">
              <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatCurrency(trip.total_cost)}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('trips.total')}</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="4" rx="2"/>
            <line x1="16" x2="16" y1="2" y2="6"/>
            <line x1="8" x2="8" y1="2" y2="6"/>
            <line x1="3" x2="21" y1="10" y2="10"/>
          </svg>
          {formatDate(trip.start_date)} – {formatDate(trip.end_date)}
        </div>
        {trip.description && (
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
            {trip.description}
          </p>
        )}
        {trip.location && (
          <div className="flex items-center gap-1.5 text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            {trip.location}
          </div>
        )}
        {trip.accommodation_type && (
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>
            <span className="font-medium">{t('trips.accommodation')}</span> {trip.accommodation_type}
          </p>
        )}
        {trip.inclusions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {trip.inclusions.map((inc, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                {inc}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-4">
          {isRegistered && (
            <div
              className="mb-3 px-4 py-2.5 rounded-xl flex items-center justify-between"
              style={{ backgroundColor: STATUS_STYLES[registration!.status].bg }}
            >
              <p className="text-sm font-medium"
                style={{ color: STATUS_STYLES[registration!.status].color }}>
                {STATUS_STYLES[registration!.status].label}
              </p>
              {registration!.status === 'pending' && (
                <button
                  onClick={() => onCancel(registration!.id)}
                  disabled={isCancelling}
                  className="text-xs font-medium disabled:opacity-50"
                  style={{ color: STATUS_STYLES[registration!.status].color }}
                >
                  {t('trips.cancel')}
                </button>
              )}
            </div>
          )}

          {userRole !== 'guest' && (milestones.length > 0 || myPayments.length > 0) && registration?.status === 'approved' && (
            <div className="border-t border-black/5">
              <button
                onClick={() => setExpanded(e => !e)}
                className="w-full py-3 flex items-center justify-between text-sm font-medium hover:bg-black/[0.02] transition-colors"
                style={{ color: 'var(--text-primary)' }}
              >
                <span>
                  {t('trips.payments')}
                  {myPayments.length > 0 && (
                    <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-secondary)' }}>
                      {formatCurrency(totalPaid)} {t('trips.paidOf')} {formatCurrency(trip.total_cost)}
                    </span>
                  )}
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              {expanded && (
                <div className="pb-4">
                  {trip.total_cost > 0 && (
                    <div className="mb-4">
                      <div className="h-1.5 rounded-full overflow-hidden"
                        style={{ backgroundColor: 'rgba(0,0,0,0.06)' }}>
                        <div className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (totalPaid / trip.total_cost) * 100)}%`,
                            backgroundColor: 'var(--brand-teal)',
                          }} />
                      </div>
                      <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>
                        {Math.round((totalPaid / trip.total_cost) * 100)}{t('trips.paidPercent')}
                      </p>
                    </div>
                  )}
                  {milestones.length > 0 && (
                    <div className="space-y-2 mb-4">
                      <p className="text-xs font-semibold tracking-widest uppercase"
                        style={{ color: 'var(--text-secondary)' }}>
                        {t('trips.milestones')}
                      </p>
                      {milestones.map((m, i) => {
                        const paid = myPayments.filter(p => p.status === 'completed')
                          .reduce((sum, p) => sum + p.amount, 0)
                        const isCovered = paid >= milestones.slice(0, i + 1)
                          .reduce((sum, ms) => sum + ms.amount, 0)
                        return (
                          <div key={i} className="flex items-center justify-between py-2 border-b border-black/5 last:border-0">
                            <div className="flex items-center gap-2.5">
                              <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: isCovered ? 'var(--brand-teal)' : 'rgba(0,0,0,0.08)' }}>
                                {isCovered && (
                                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none"
                                    stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"/>
                                  </svg>
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{m.label}</p>
                                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('trips.due')} {formatDate(m.due_date)}</p>
                              </div>
                            </div>
                            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                              {formatCurrency(m.amount)}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {myPayments.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold tracking-widest uppercase"
                        style={{ color: 'var(--text-secondary)' }}>
                        {t('trips.paymentHistory')}
                      </p>
                      {myPayments.map(p => (
                        <div key={p.id} className="flex items-center justify-between py-2 border-b border-black/5 last:border-0">
                          <div>
                            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                              {formatDate(p.transaction_date)}
                            </p>
                            {p.note && (
                              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{p.note}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold"
                              style={{ color: p.status === 'completed' ? 'var(--brand-teal)' : 'var(--text-secondary)' }}>
                              {formatCurrency(p.amount)}
                            </p>
                            {p.status !== 'completed' && (
                              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{p.status}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {isRegistered ? (
            <button
              onClick={() => router.push(`/trips/${trip.id}`)}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white hover:opacity-90 active:opacity-70 transition-opacity"
              style={{ backgroundColor: 'var(--brand-forest)' }}
            >
              {t('trips.viewDetails')}
            </button>
          ) : (
            userRole === 'guest' ? (
              <p className="text-xs text-center py-2 rounded-xl"
                style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--border-default)' }}>
                {t('trips.memberOnly')}
              </p>
            ) : (
              <RegisterButton tripId={trip.id} profileId={profileId} />
            )
          )}
        </div>
      </div>
    </div>
  )
}

export default function TripsPage() {
  const { isSignedIn, isLoaded } = useUser()
  const qc = useQueryClient()
  const { t } = useLanguage()

  const { data: profile } = useQuery<UserProfile>({
    queryKey: ['profile'],
    queryFn: () => fetch('/api/profile').then(r => r.json()),
    enabled: !!isSignedIn,
  })

  const { data: trips = [], isLoading } = useQuery<Trip[]>({
    queryKey: ['trips'],
    queryFn: () => fetch('/api/trips').then(r => r.json()),
    enabled: isLoaded,
  })

  const { data: registrations = [] } = useQuery<Registration[]>({
    queryKey: ['registrations', 'user', profile?.id],
    queryFn: () =>
      Promise.all(trips.map(trip =>
        fetch(`/api/trips/${trip.id}/registrations`).then(r => r.json())
      )).then(results =>
        results.flat().filter((r: Registration) => r.profile_id === profile?.id)
      ),
    enabled: trips.length > 0 && !!profile?.id,
  })

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ['payments', 'user', profile?.id],
    queryFn: () =>
      Promise.all(
        registrations
          .filter(r => r.status === 'approved')
          .map(r => fetch(`/api/trips/${r.trip_id}/payments`).then(res => res.json()))
      ).then(results => results.flat()),
    enabled: registrations.filter(r => r.status === 'approved').length > 0,
  })

  const cancelMutation = useMutation({
    mutationFn: (registrationId: string) =>
      fetch(`/api/admin/registrations/${registrationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'denied' }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['registrations'] }),
  })

  const regFor = (tripId: string) => registrations.find(r => r.trip_id === tripId)

  return (
    <div className="py-8 pb-16">
      <div className="max-w-[960px] mx-auto px-4">
        {/* Mobile: single-column stack */}
        <div className="md:hidden flex flex-col gap-3">
          {isLoading || !isLoaded ? (
            [...Array(2)].map((_, i) => (
              <div
                key={i}
                className="rounded-2xl animate-pulse"
                style={{ height: 240, backgroundColor: 'var(--border-default)' }}
              />
            ))
          ) : trips.length === 0 ? (
            <div
              className="rounded-2xl flex flex-col items-center justify-center py-16"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                className="mb-4">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{t('trips.noTrips')}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{t('trips.noTripsDesc')}</p>
            </div>
          ) : (
            trips.map(trip => (
              <TripCard
                key={trip.id}
                trip={trip}
                registration={regFor(trip.id)}
                payments={payments}
                profileId={profile?.id ?? null}
                onCancel={(id) => cancelMutation.mutate(id)}
                isCancelling={cancelMutation.isPending}
                t={t}
                userRole={profile?.role ?? 'guest'}
              />
            ))
          )}
        </div>

        {/* Desktop: 2-up 8-col grid */}
        <div
          className="hidden md:grid"
          style={{
            gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
            gap: '12px',
            gridAutoRows: 'minmax(120px, auto)',
          }}
        >
          {isLoading || !isLoaded ? (
            [...Array(2)].map((_, i) => (
              <div
                key={i}
                className="rounded-2xl animate-pulse"
                style={{
                  gridColumn: 'span 4',
                  gridRow: 'span 2',
                  backgroundColor: 'var(--border-default)',
                  minHeight: 240,
                }}
              />
            ))
          ) : trips.length === 0 ? (
            <div
              style={{
                gridColumn: 'span 8',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
              }}
              className="rounded-2xl flex flex-col items-center justify-center py-16"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                className="mb-4">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{t('trips.noTrips')}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{t('trips.noTripsDesc')}</p>
            </div>
          ) : (
            trips.map(trip => (
              <div
                key={trip.id}
                style={{ gridColumn: 'span 4', gridRow: 'span 2', minHeight: 240 }}
              >
                <TripCard
                  trip={trip}
                  registration={regFor(trip.id)}
                  payments={payments}
                  profileId={profile?.id ?? null}
                  onCancel={(id) => cancelMutation.mutate(id)}
                  isCancelling={cancelMutation.isPending}
                  t={t}
                  userRole={profile?.role ?? 'guest'}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
