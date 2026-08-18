import { TripImage, TripBadges, PriceDisplay, DateBadge, PinIcon } from './TripShared'
import { excerptFromJSONContent } from '@/lib/format'
import type { CardProps } from '../TripsClient'

export default function TripCard(props: CardProps) {
  const { trip, ctaNode, isCompleted } = props
  const isGuest = props.userRole === 'guest'
  const descriptionText = excerptFromJSONContent(trip.description)
  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col md:h-full md:min-h-[300px]"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
    >
      <TripImage src={trip.image_url} heightClassName="h-[180px] md:h-[220px]" overlay muted={isCompleted}>
        <div className="px-4 pb-3 md:px-5 md:pb-4">
          <TripBadges destination={trip.destination} tripType={trip.trip_type} completedLabel={isCompleted ? props.t('trips.status.completed') : null} />
          <h3 className="font-display text-xl md:text-2xl font-semibold leading-snug text-on-accent">
            {trip.title}
          </h3>
        </div>
      </TripImage>
      <div className="px-5 pt-4 pb-5 md:px-6 md:pt-5 md:pb-6 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-3 md:gap-4">
          <div className="md:hidden">
            <DateBadge trip={trip} iconSize={13} textClassName="text-xs" />
          </div>
          <div className="hidden md:block">
            <DateBadge trip={trip} iconSize={14} textClassName="text-sm" />
          </div>
          <PriceDisplay
            totalCost={trip.total_cost}
            label={props.t('trips.total')}
            isGuest={isGuest}
            priceClassName="text-base md:text-xl"
          />
        </div>
        {descriptionText && (
          <div className="hidden md:block">
            <p className="text-sm leading-relaxed" style={{
              color: 'var(--text-secondary)',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {descriptionText}
            </p>
          </div>
        )}
        {trip.location && (
          <div className="hidden md:flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
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
