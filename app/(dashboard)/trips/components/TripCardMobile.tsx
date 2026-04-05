import { TripImage, TripBadges, PriceDisplay, DateBadge } from './TripShared'
import type { CardProps } from '../TripsClient'

export default function TripCardMobile(props: CardProps) {
  const { trip, ctaNode } = props
  const isGuest = props.userRole === 'guest'
  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
    >
      <TripImage src={trip.image_url} height={140} />
      <div className="px-5 pt-4 pb-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <TripBadges destination={trip.destination} tripType={trip.trip_type} />
            <h3 className="font-display text-xl font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
              {trip.title}
            </h3>
          </div>
          <PriceDisplay
            totalCost={trip.total_cost}
            label={props.t('trips.total')}
            isGuest={isGuest}
            priceClassName="text-base"
          />
        </div>
        <DateBadge trip={trip} iconSize={13} textClassName="text-xs" />
        <div className="mt-auto flex flex-col gap-2">
          {ctaNode}
        </div>
      </div>
    </div>
  )
}
