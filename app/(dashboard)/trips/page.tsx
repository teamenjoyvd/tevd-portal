'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@clerk/nextjs'

// ── Types ──────────────────────────────────────────────────────────────────

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

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function formatEur(amount: number) {
  return new Intl.NumberFormat('en-DE', { style: 'currency', currency: 'EUR' }).format(amount)
}

function tripDuration(start: string, end: string) {
  const days = Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 86400000
  )
  return `${days} day${days !== 1 ? 's' : ''}`
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pending:  { bg: '#f2cc8f33', color: '#7a5c00', label: 'Pending approval' },
  approved: { bg: '#81b29a33', color: '#2d6a4f', label: 'Approved'         },
  denied:   { bg: '#bc474920', color: '#bc4749', label: 'Declined'         },
}

// ── Trip card ──────────────────────────────────────────────────────────────

function TripCard({
  trip,
  registration,
  payments,
  profileId,
  onRegister,
  onCancel,
  isPending,
}: {
  trip: Trip
  registration: Registration | undefined
  payments: Payment[]
  profileId: string | null
  onRegister: (tripId: string) => void
  onCancel: (registrationId: string) => void
  isPending: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const myPayments = payments.filter(p => p.trip_id === trip.id)
  const totalPaid = myPayments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0)

  const milestones: Milestone[] = Array.isArray(trip.milestones) ? trip.milestones : []

  return (
    <div className="bg-white rounded-2xl border border-black/5 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'var(--forest)', color: 'rgba(255,255,255,0.85)' }}
              >
                {trip.destination}
              </span>
              <span className="text-xs" style={{ color: 'var(--stone)' }}>
                {tripDuration(trip.start_date, trip.end_date)}
              </span>
            </div>
            <h3 className="font-serif text-xl font-semibold leading-snug"
              style={{ color: 'var(--deep)' }}>
              {trip.title}
            </h3>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-semibold" style={{ color: 'var(--deep)' }}>
              {formatEur(trip.total_cost)}
            </p>
            <p className="text-xs" style={{ color: 'var(--stone)' }}>total</p>
          </div>
        </div>

        {/* Dates */}
        <div className="flex items-center gap-1.5 text-xs mb-3" style={{ color: 'var(--stone)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="4" rx="2"/>
            <line x1="16" x2="16" y1="2" y2="6"/>
            <line x1="8" x2="8" y1="2" y2="6"/>
            <line x1="3" x2="21" y1="10" y2="10"/>
          </svg>
          {formatDate(trip.start_date)} – {formatDate(trip.end_date)}
        </div>

        {/* Description */}
        {trip.description && (
          <p className="text-sm leading-relaxed" style={{ color: 'var(--stone)' }}>
            {trip.description}
          </p>
        )}
      </div>

      {/* Registration status bar */}
      {registration && (
        <div
          className="mx-5 mb-4 px-4 py-2.5 rounded-xl flex items-center justify-between"
          style={{ backgroundColor: STATUS_STYLES[registration.status].bg }}
        >
          <p className="text-sm font-medium"
            style={{ color: STATUS_STYLES[registration.status].color }}>
            {STATUS_STYLES[registration.status].label}
          </p>
          {registration.status === 'pending' && (
            <button
              onClick={() => onCancel(registration.id)}
              disabled={isPending}
              className="text-xs font-medium disabled:opacity-50"
              style={{ color: STATUS_STYLES[registration.status].color }}
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Milestones + payments — collapsible */}
      {(milestones.length > 0 || myPayments.length > 0) && registration?.status === 'approved' && (
        <div className="border-t border-black/5">
          <button
            onClick={() => setExpanded(e => !e)}
            className="w-full px-5 py-3 flex items-center justify-between text-sm font-medium hover:bg-black/[0.02] transition-colors"
            style={{ color: 'var(--deep)' }}
          >
            <span>
              Payments
              {myPayments.length > 0 && (
                <span className="ml-2 text-xs font-normal" style={{ color: 'var(--stone)' }}>
                  {formatEur(totalPaid)} paid of {formatEur(trip.total_cost)}
                </span>
              )}
            </span>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {expanded && (
            <div className="px-5 pb-5">
              {/* Payment progress bar */}
              {trip.total_cost > 0 && (
                <div className="mb-4">
                  <div className="h-1.5 rounded-full overflow-hidden"
                    style={{ backgroundColor: 'rgba(0,0,0,0.06)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (totalPaid / trip.total_cost) * 100)}%`,
                        backgroundColor: 'var(--sage)',
                      }}
                    />
                  </div>
                  <p className="text-xs mt-1.5" style={{ color: 'var(--stone)' }}>
                    {Math.round((totalPaid / trip.total_cost) * 100)}% paid
                  </p>
                </div>
              )}

              {/* Milestones */}
              {milestones.length > 0 && (
                <div className="space-y-2 mb-4">
                  <p className="text-xs font-semibold tracking-widest uppercase"
                    style={{ color: 'var(--stone)' }}>
                    Milestones
                  </p>
                  {milestones.map((m, i) => {
                    const paid = myPayments
                      .filter(p => p.status === 'completed')
                      .reduce((sum, p) => sum + p.amount, 0)
                    const isCovered = paid >= milestones
                      .slice(0, i + 1)
                      .reduce((sum, ms) => sum + ms.amount, 0)
                    return (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-black/5 last:border-0">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: isCovered ? 'var(--sage)' : 'rgba(0,0,0,0.08)' }}
                          >
                            {isCovered && (
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none"
                                stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium" style={{ color: 'var(--deep)' }}>
                              {m.label}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--stone)' }}>
                              Due {formatDate(m.due_date)}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--deep)' }}>
                          {formatEur(m.amount)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Payment history */}
              {myPayments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold tracking-widest uppercase"
                    style={{ color: 'var(--stone)' }}>
                    Payment history
                  </p>
                  {myPayments.map(p => (
                    <div key={p.id}
                      className="flex items-center justify-between py-2 border-b border-black/5 last:border-0">
                      <div>
                        <p className="text-sm" style={{ color: 'var(--deep)' }}>
                          {formatDate(p.transaction_date)}
                        </p>
                        {p.note && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--stone)' }}>{p.note}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold"
                          style={{ color: p.status === 'completed' ? 'var(--sage)' : 'var(--stone)' }}>
                          {formatEur(p.amount)}
                        </p>
                        {p.status !== 'completed' && (
                          <p className="text-xs" style={{ color: 'var(--stone)' }}>{p.status}</p>
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

      {/* CTA */}
      {!registration && (
        <div className="px-5 pb-5">
          <button
            onClick={() => onRegister(trip.id)}
            disabled={isPending || !profileId}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50 hover:opacity-90 active:opacity-70"
            style={{ backgroundColor: 'var(--crimson)' }}
          >
            Register for this trip
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function TripsPage() {
  const { isSignedIn } = useUser()
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const { data: profile } = useQuery<UserProfile>({
    queryKey: ['profile'],
    queryFn: () => fetch('/api/profile').then(r => r.json()),
    enabled: !!isSignedIn,
  })

  const { data: trips = [], isLoading } = useQuery<Trip[]>({
    queryKey: ['trips'],
    queryFn: () => fetch('/api/trips').then(r => r.json()),
  })

  const { data: registrations = [] } = useQuery<Registration[]>({
    queryKey: ['registrations', 'user', profile?.id],
    queryFn: () =>
      Promise.all(trips.map(t =>
        fetch(`/api/trips/${t.id}/registrations`).then(r => r.json())
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

  const registerMutation = useMutation({
    mutationFn: (tripId: string) =>
      fetch(`/api/trips/${tripId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registrations'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      setError(null)
    },
    onError: (e: Error) => setError(e.message),
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

  const regFor = (tripId: string) =>
    registrations.find(r => r.trip_id === tripId)

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-semibold" style={{ color: 'var(--deep)' }}>
          Trips
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--stone)' }}>
          Team travel — register and track your payments.
        </p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm"
          style={{ backgroundColor: '#bc474915', color: 'var(--crimson)' }}>
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-48 rounded-2xl animate-pulse"
              style={{ backgroundColor: 'rgba(0,0,0,0.06)' }} />
          ))}
        </div>
      ) : trips.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
              stroke="var(--stone)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <p className="font-medium" style={{ color: 'var(--deep)' }}>No trips yet</p>
          <p className="text-sm mt-1" style={{ color: 'var(--stone)' }}>
            Check back soon — upcoming trips will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {trips.map(trip => (
            <TripCard
              key={trip.id}
              trip={trip}
              registration={regFor(trip.id)}
              payments={payments}
              profileId={profile?.id ?? null}
              onRegister={(id) => registerMutation.mutate(id)}
              onCancel={(id) => cancelMutation.mutate(id)}
              isPending={registerMutation.isPending || cancelMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}