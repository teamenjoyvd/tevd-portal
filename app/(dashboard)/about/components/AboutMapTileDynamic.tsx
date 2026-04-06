'use client'

import dynamic from 'next/dynamic'

// AboutMapTile uses Mapbox GL JS which relies on browser APIs (window,
// navigator). Wrapping in next/dynamic with ssr:false keeps the server
// render clean and defers the Mapbox chunk until the client hydrates.
// 'use client' is required — next/dynamic ssr:false is only valid inside
// a client component boundary (Next.js 16 enforces this at build time).
const AboutMapTileDynamic = dynamic(
  () => import('./AboutMapTile'),
  { ssr: false }
)

export default AboutMapTileDynamic
