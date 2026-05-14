'use client'

import Link from 'next/link'
import { formatDate, formatCurrency } from '@/lib/format'
import type { Tables } from '@/types/supabase'
import type { TripProfile } from '../page'
import { useLanguage } from '@/lib/hooks/useLanguage'

type Trip = Tables<'trips'>

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

export function TripHero({
  trip,
  profile,
  muted = false,
}: {
  trip: Trip
  profile: TripProfile
  muted?: boolean
}) {
  const { t } = useLanguage()
  const days = Math.round(
    (new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / 86400000
  )

  const imageFilter = muted ? 'opacity(0.5) grayscale(1)' : undefined
  const badgeBg = muted ? 'rgba(0,0,0,0.15)' : 'var(--brand-forest)'
  const badgeColor = muted ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.85)'
  const tealBadgeBg = muted ? 'rgba(0,0,0,0.12)' : 'var(--brand-teal)'

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
    >
      {/* Hero image area — 280px with gradient overlay */}
      <div
        className="relative w-full"
        style={{ height: 280, backgroundColor: 'var(--brand-forest)' }}
      >
        {trip.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={trip.image_url}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover"
            style={imageFilter ? { filter: imageFilter } : undefined}
            onError={e => {
              const el = e.currentTarget
              el.style.display = 'none'
            }}
          />
        )}
        {/* Gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.62) 0%, transparent 55%)' }}
        />
        {/* Title + badges over image */}
        <div className="absolute bottom-4 left-6 right-6">
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: badgeBg, color: badgeColor }}
            >
              {trip.destination}
            </span>
            {trip.trip_type && (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: tealBadgeBg, color: badgeColor }}
              >
                {trip.trip_type}
              </span>
            )}
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
              {days} day{days !== 1 ? 's' : ''}
            </span>
          </div>
          <h1
            className="font-display text-2xl font-semibold leading-snug"
            style={{ color: '#fff' }}
          >
            {trip.title}
          </h1>
        </div>
      </div>

      {/* Content below image */}
      <div className="px-6 pt-5 pb-8">
        {profile.role !== 'guest' && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
              {formatDate(trip.start_date)} – {formatDate(trip.end_date)}
            </div>
            <div className="text-right">
              <p className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatCurrency(trip.total_cost)}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('trips.totalCost')}</p>
            </div>
          </div>
        )}

        {trip.description && (
          <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
            {trip.description}
          </p>
        )}

        {(trip.location || trip.accommodation_type) && (
          <div className="flex flex-wrap items-center gap-3 text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            {trip.location && (
              <span className="flex items-center gap-1">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {trip.location}
              </span>
            )}
            {trip.accommodation_type && (
              <span>{trip.accommodation_type}</span>
            )}
          </div>
        )}

        {trip.inclusions.length > 0 && (
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase mb-2"
              style={{ color: 'var(--text-secondary)' }}>
              {t('trips.inclusions')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {trip.inclusions.map((inc, i) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: 'rgba(129,178,154,0.15)', color: 'var(--text-primary)' }}>
                  {inc}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
