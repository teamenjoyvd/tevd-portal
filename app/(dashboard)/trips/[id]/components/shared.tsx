'use client'

import { useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { generateHTML } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'
import TiptapLink from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import type { JSONContent } from '@tiptap/core'
import { formatDate, formatCurrency } from '@/lib/format'
import { clampLuminance, hslToHex } from '@/lib/color'
import type { Tables } from '@/types/supabase'
import type { TripProfile } from '../page'
import { useLanguage } from '@/lib/hooks/useLanguage'

type Trip = Tables<'trips'>

export const FALLBACK_ACCENT = '#2d6a4f'

const TIPTAP_EXTENSIONS = [StarterKit, TiptapLink, Image]

// ---------------------------------------------------------------------------
// BackButton
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// TripHeroImage
// Renders the 280px image pane. Samples canvas to derive accent colour,
// calls onAccentColor with blended hex. Falls back to FALLBACK_ACCENT on
// cross-origin SecurityError or missing image.
// ---------------------------------------------------------------------------
export function TripHeroImage({
  trip,
  muted = false,
  onAccentColor,
}: {
  trip: Trip
  muted?: boolean
  onAccentColor: (hex: string) => void
}) {
  const { t } = useLanguage()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Fallback when no image — must be in useEffect to avoid render-phase state update
  useEffect(() => {
    if (!trip.image_url) {
      onAccentColor(FALLBACK_ACCENT)
    }
  }, [trip.image_url, onAccentColor])

  const imageFilter = muted ? 'opacity(0.5) grayscale(1)' : undefined
  const badgeBg = muted ? 'rgba(0,0,0,0.15)' : 'var(--brand-forest)'
  const badgeColor = muted ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.85)'
  const tealBadgeBg = muted ? 'rgba(0,0,0,0.12)' : 'var(--brand-teal)'

  const days = Math.round(
    (new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / 86400000
  )

  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    try {
      const img = e.currentTarget
      const canvas = canvasRef.current
      if (!canvas) { onAccentColor(FALLBACK_ACCENT); return }

      const sampleX = 0
      const sampleY = Math.max(0, img.naturalHeight - 60)
      const sampleW = Math.min(50, img.naturalWidth)
      const sampleH = Math.min(50, img.naturalHeight - sampleY)

      canvas.width = sampleW
      canvas.height = sampleH
      const ctx = canvas.getContext('2d')
      if (!ctx) { onAccentColor(FALLBACK_ACCENT); return }

      ctx.drawImage(img, sampleX, sampleY, sampleW, sampleH, 0, 0, sampleW, sampleH)
      const data = ctx.getImageData(0, 0, sampleW, sampleH).data

      let r = 0, g = 0, b = 0, count = 0
      for (let i = 0; i < data.length; i += 4) {
        r += data[i]; g += data[i + 1]; b += data[i + 2]; count++
      }
      if (count === 0) { onAccentColor(FALLBACK_ACCENT); return }
      r = Math.round(r / count)
      g = Math.round(g / count)
      b = Math.round(b / count)
      // Blend toward forest to keep it on-brand
      const blendR = Math.round(r * 0.6 + 0x2d * 0.4)
      const blendG = Math.round(g * 0.6 + 0x6a * 0.4)
      const blendB = Math.round(b * 0.6 + 0x4f * 0.4)
      // Clamp HSL luminance to [30, 55] range
      const hex = clampLuminance(blendR, blendG, blendB, 30, 55)
      onAccentColor(hex)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'SecurityError') {
        onAccentColor(FALLBACK_ACCENT)
      } else {
        onAccentColor(FALLBACK_ACCENT)
      }
    }
  }

  return (
    <div style={{ backgroundColor: 'var(--brand-forest)' }}>
      {/* Hidden canvas for pixel sampling — never rendered visually */}
      <canvas ref={canvasRef} style={{ display: 'none' }} aria-hidden="true" />

      <div className="relative w-full" style={{ height: 280 }}>
        {trip.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={trip.image_url}
            alt=""
            aria-hidden="true"
            crossOrigin="anonymous"
            className="w-full h-full object-cover"
            style={imageFilter ? { filter: imageFilter } : undefined}
            onLoad={handleImageLoad}
            onError={e => {
              onAccentColor(FALLBACK_ACCENT)
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : null}
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
              {days} {t(days !== 1 ? 'trips.dayPlural' : 'trips.daySingular')}
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
    </div>
  )
}

// ---------------------------------------------------------------------------
// TripDescription
// Renders trip.description (JSONContent) as rich HTML via generateHTML.
// Guards against null (trips created before the jsonb migration).
// generateHTML is memoized to avoid re-running the tree traversal on
// parent re-renders where description hasn't changed.
// ---------------------------------------------------------------------------
function TripDescription({ description }: { description: JSONContent | null }) {
  const html = useMemo(
    () => (description ? generateHTML(description, TIPTAP_EXTENSIONS) : null),
    [description],
  )
  if (!html) return null
  return (
    <div
      className="tiptap-output mb-5"
      // Content is generated from admin-controlled JSONContent — no user-submitted HTML.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// ---------------------------------------------------------------------------
// TripDetail
// Renders optional countdown strip + body content (dates, cost, description,
// location, inclusions). accentColor drives the strip bg.
// When trip.counter_bg_color is set, it takes precedence over the
// canvas-derived accentColor passed from the parent view.
// ---------------------------------------------------------------------------
export function TripDetail({
  trip,
  profile,
  accentColor,
  countdown,
}: {
  trip: Trip
  profile: TripProfile
  accentColor: string
  countdown?: number
}) {
  const { t } = useLanguage()

  // Stored colour overrides the canvas-derived one
  const stripColor = trip.counter_bg_color ?? accentColor

  return (
    <div style={{ backgroundColor: 'var(--bg-card)' }}>
      {/* Countdown strip — only when countdown prop is provided */}
      {countdown !== undefined && (
        <div
          className="w-full px-6 py-3 flex items-center justify-between gap-3"
          style={{ backgroundColor: stripColor }}
        >
          <div className="flex items-baseline gap-2 min-w-0">
            <span
              className="font-display font-bold leading-none flex-shrink-0"
              style={{ fontSize: 'clamp(2rem, 8vw, 3rem)', color: '#fff' }}
            >
              {countdown}
            </span>
            <span
              className="text-sm font-medium"
              style={{ color: 'rgba(255,255,255,0.85)', whiteSpace: 'nowrap' }}
            >
              {t('trips.daysToGo')}
            </span>
          </div>
          {countdown === 0 && (
            <span
              className="text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff' }}
            >
              {t('trips.todayBadge')}
            </span>
          )}
        </div>
      )}

      {/* Body content */}
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

        <TripDescription description={trip.description as JSONContent | null} />

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

// ---------------------------------------------------------------------------
// Helpers — kept here for the member-side canvas sampling in TripHeroImage.
// The shared colour utilities (clampLuminance, hslToHex) are in lib/color.ts.
// ---------------------------------------------------------------------------

// Re-export hslToHex so any existing imports from this file continue to work
export { hslToHex }
