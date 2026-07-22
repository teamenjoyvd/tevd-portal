import { formatDate, formatCurrency } from '@/lib/format'
import type { Trip } from '../page'

/**
 * A trip is "completed" once its end date is strictly before today.
 * Compared as date-only strings (local today) to avoid UTC/local boundary skew —
 * a trip ending today is NOT yet completed.
 */
export function isTripCompleted(endDate: string): boolean {
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return endDate.slice(0, 10) < todayStr
}

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

/**
 * TripImage — image area with optional overlay and child slot.
 *
 * When overlay=true, renders a dark gradient over the image and accepts
 * children positioned absolutely at the bottom of the container.
 */
export function TripImage({
  src,
  heightClassName,
  overlay = false,
  muted = false,
  children,
}: {
  src: string | null | undefined
  /** Tailwind height classes, e.g. `"h-[180px] md:h-[220px]"` — responsive since desktop/mobile use different fixed heights. */
  heightClassName: string
  overlay?: boolean
  /** Desaturate the image (e.g. for completed trips). */
  muted?: boolean
  children?: React.ReactNode
}) {
  return (
    <div
      className={`w-full flex-shrink-0 relative ${heightClassName}`}
      style={{ backgroundColor: 'var(--brand-forest)' }}
    >
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover"
          style={muted ? { filter: 'grayscale(0.7)' } : undefined}
          onError={e => {
            const el = e.currentTarget
            el.style.display = 'none'
          }}
        />
      )}
      {overlay && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 60%)' }}
        />
      )}
      {children && (
        <div className="absolute bottom-0 left-0 right-0">
          {children}
        </div>
      )}
    </div>
  )
}

export function TripBadges({ destination, tripType, completedLabel }: { destination: string; tripType: string | null | undefined; completedLabel?: string | null }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
      {completedLabel && (
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: 'var(--brand-stone)', color: 'rgba(255,255,255,0.95)' }}
        >
          {completedLabel}
        </span>
      )}
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
