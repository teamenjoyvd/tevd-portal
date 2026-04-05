import Link from 'next/link'
import { formatDate } from '@/lib/format'

type Trip = {
  id: string
  title: string
  destination: string
  start_date: string
  image_url: string | null
}

type Props = {
  trip: Trip
}

export default function TripHeroTile({ trip }: Props) {
  return (
    <>
      {trip.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={trip.image_url}
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.45,
            pointerEvents: 'none',
          }}
        />
      )}
      <div className="absolute top-0 left-0 right-0 flex items-start justify-end px-5 pt-5 z-10">
        <Link href="/trips" className="font-body text-[11px] font-bold tracking-widest uppercase pill-link-parchment">
          Trips →
        </Link>
      </div>
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 z-10">
        <h3
          className="font-display text-2xl font-semibold leading-tight"
          style={{ color: 'var(--brand-parchment)' }}
        >
          {trip.title}
        </h3>
        <div className="flex items-center gap-2 mt-1">
          <span
            className="font-body text-[11px] font-bold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: 'var(--brand-parchment)' }}
          >
            {trip.destination}
          </span>
          <p className="font-body text-[12px]" style={{ color: 'rgba(242,239,232,0.65)' }}>
            {formatDate(trip.start_date)}
          </p>
        </div>
      </div>
    </>
  )
}
