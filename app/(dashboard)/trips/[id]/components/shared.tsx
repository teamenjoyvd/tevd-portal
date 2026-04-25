'use client'

import Link from 'next/link'
import { formatDate, formatCurrency } from '@/lib/format'
import type { Tables } from '@/types/supabase'
import type { TripProfile } from '../page'
import { useLanguage } from '@/lib/hooks/useLanguage'

type Trip = Tables<'trips'>
type Milestone = { label: string; amount: number; due_date: string }

export function BackButton() {
  return (
    <Link
      href="/trips"
      className="inline-flex items-center gap-1.5 text-sm font-medium mb-6 pill-link-crimson"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      Back to trips
    </Link>
  )
}

export function TripHero({ trip, profile }: { trip: Trip; profile: TripProfile }) {
  const { t } = useLanguage()
  const milestones: Milestone[] = Array.isArray(trip.milestones)
    ? (trip.milestones as Milestone[])
    : []
  const days = Math.round(
    (new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / 86400000
  )

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      {trip.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={trip.image_url}
          alt=""
          aria-hidden="true"
          className="w-full object-cover"
          style={{ height: 240 }}
        />
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
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('trips.totalCost')}</p>
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
            <span className="font-medium">Accommodation:</span>{' '}{trip.accommodation_type}
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
              Payment milestones
            </p>
            <div className="space-y-2">
              {milestones.map((m, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0"
                  style={{ borderColor: 'var(--border-default)' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{m.label}</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      Due {formatDate(m.due_date)}
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
