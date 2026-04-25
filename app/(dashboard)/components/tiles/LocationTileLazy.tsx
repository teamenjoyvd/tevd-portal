'use client'

// next/dynamic with ssr:false must live in a Client Component.
// This thin wrapper is the client boundary; the RSC imports this file instead.
import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

const LocationTileDynamic = dynamic(
  () => import('@/app/(dashboard)/components/tiles/LocationTile'),
  {
    ssr: false,
    loading: () => (
      <Skeleton className="rounded-2xl" style={{ minHeight: 200, gridColumn: 'span 3' }} />
    ),
  },
)

export default function LocationTileLazy(props: {
  colSpan?: number
  mobileColSpan?: number
  rowSpan?: number
  style?: React.CSSProperties
}) {
  return <LocationTileDynamic {...props} />
}
