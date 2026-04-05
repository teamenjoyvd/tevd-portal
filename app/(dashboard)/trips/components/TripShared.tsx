import { formatDate, formatCurrency } from '@/lib/format'
import type { Trip } from '../page'

export function CalendarIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  )
}

export function PinIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
    </svg>
  )
}

export function TripImage({ src, height }: { src: string | null | undefined; height: number }) {
  return (
    <div
      className="w-full flex-shrink-0"
      style={{ height, backgroundColor: 'var(--brand-forest)' }}
    >
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover"
        />
      )}
    </div>
  )
}

export function TripBadges({ destination, tripType }: { destination: string; tripType: string | null | undefined }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
      <span
        className="text-xs font-semibold px-2 py-0.5 rounded-full"
        style={{ backgroundColor: 'var(--brand-forest)', color: 'rgba(255,255,255,0.85)' }}
      >
        {destination}
      </span>
      {tripType && (
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: 'var(--brand-teal)', color: 'rgba(255,255,255,0.85)' }}
        >
          {tripType}
        </span>
      )}
    </div>
  )
}

export function PriceDisplay({
  totalCost,
  label,
  isGuest,
  priceClassName,
}: {
  totalCost: number
  label: string
  isGuest: boolean
  priceClassName: string
}) {
  const inner = (
    <>
      <p className={`${priceClassName} font-semibold`} style={{ color: 'var(--text-primary)' }}>
        {formatCurrency(totalCost)}
      </p>
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</p>
    </>
  )
  if (isGuest) {
    return (
      <div
        className="text-right flex-shrink-0 select-none"
        style={{ filter: 'blur(6px)', pointerEvents: 'none' }}
        aria-hidden="true"
      >
        {inner}
      </div>
    )
  }
  return <div className="text-right flex-shrink-0">{inner}</div>
}

export function DateBadge({ trip, iconSize, textClassName }: {
  trip: Pick<Trip, 'start_date' | 'end_date'>
  iconSize: number
  textClassName: string
}) {
  return (
    <div className={`flex items-center gap-1.5 ${textClassName}`} style={{ color: 'var(--text-secondary)' }}>
      <CalendarIcon size={iconSize} />
      {formatDate(trip.start_date)} – {formatDate(trip.end_date)}
    </div>
  )
}
