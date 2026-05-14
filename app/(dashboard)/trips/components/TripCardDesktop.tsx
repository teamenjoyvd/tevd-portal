import { TripImage, TripBadges, PriceDisplay, DateBadge, PinIcon } from './TripShared'
import type { CardProps } from '../TripsClient'

export default function TripCardDesktop(props: CardProps) {
  const { trip, ctaNode } = props
  const isGuest = props.userRole === 'guest'
  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col h-full"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)', minHeight: 300 }}
    >
      <TripImage src={trip.image_url} height={220} overlay>
        <div className="px-5 pb-4">
          <TripBadges destination={trip.destination} tripType={trip.trip_type} />
          <h3 className="font-display text-2xl font-semibold leading-snug text-white">
            {trip.title}
          </h3>
        </div>
      </TripImage>
      <div className="px-6 pt-5 pb-6 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-4">
          <DateBadge trip={trip} iconSize={14} textClassName="text-sm" />
          <PriceDisplay
            totalCost={trip.total_cost}
            label={props.t('trips.total')}
            isGuest={isGuest}
            priceClassName="text-xl"
          />
        </div>
        {trip.description && (
          <p className="text-sm leading-relaxed" style={{
            color: 'var(--text-secondary)',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {trip.description}
          </p>
        )}
        {trip.location && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <PinIcon size={12} />
            {trip.location}
          </div>
        )}
        <div className="mt-auto flex flex-col gap-2">
          {ctaNode}
        </div>
      </div>
    </div>
  )
}
