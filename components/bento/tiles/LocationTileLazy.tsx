'use client'

// next/dynamic with ssr:false must live in a Client Component.
// This thin wrapper is the client boundary; the RSC imports this file instead.
import dynamic from 'next/dynamic'

const LocationTileLazy = dynamic(
  () => import('@/components/bento/tiles/LocationTile'),
  { ssr: false },
)

export default LocationTileLazy
