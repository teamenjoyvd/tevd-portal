'use client'

import { useEffect, useRef, useState } from 'react'
import BentoCard from '@/components/bento/BentoCard'

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
const SOFIA = [23.3219, 42.6977] as [number, number]

// Fallback tile shown when token is missing
function LocationFallback({ colSpan, rowSpan }: { colSpan: number; rowSpan?: number }) {
  return (
    <BentoCard variant="forest" colSpan={colSpan} rowSpan={rowSpan} className="relative flex items-end">
      <div className="absolute inset-0 flex items-center justify-center opacity-10">
        <svg width="120" height="120" viewBox="0 0 24 24" fill="none"
          stroke="var(--brand-parchment)" strokeWidth="0.5">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
      <div className="relative z-10 flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="var(--brand-parchment)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        <span className="text-sm font-semibold font-body" style={{ color: 'var(--brand-parchment)' }}>
          Sofia, Bulgaria
        </span>
      </div>
    </BentoCard>
  )
}

export default function LocationTile({ colSpan = 6, rowSpan }: { colSpan?: number; rowSpan?: number }) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!TOKEN || !mapContainer.current) return

    // Load Mapbox GL JS from CDN
    if ((window as unknown as Record<string, unknown>).mapboxgl) {
      initMap()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js'
    script.onload = initMap
    document.head.appendChild(script)

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css'
    document.head.appendChild(link)

    function initMap() {
      if (!mapContainer.current) return
      const mapboxgl = (window as unknown as Record<string, unknown>).mapboxgl as {
        Map: new (opts: Record<string, unknown>) => { remove: () => void }
        accessToken: string
      }
      mapboxgl.accessToken = TOKEN!
      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: SOFIA,
        zoom: 12,
        interactive: false,
        attributionControl: false,
      })
      setReady(true)
      return () => map.remove()
    }
  }, [])

  if (!TOKEN) return <LocationFallback colSpan={colSpan} rowSpan={rowSpan} />

  return (
    <BentoCard variant="forest" colSpan={colSpan} rowSpan={rowSpan}
      className="relative overflow-hidden p-0"
      style={{ minHeight: 240 }}>
      {/* Map fills tile */}
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Sofia label overlay */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full"
        style={{ backgroundColor: 'rgba(26,31,24,0.75)', backdropFilter: 'blur(4px)' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="var(--brand-parchment)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        <span className="text-xs font-semibold font-body" style={{ color: 'var(--brand-parchment)' }}>
          Sofia, Bulgaria
        </span>
      </div>

      {/* Loading shimmer before map renders */}
      {!ready && (
        <div className="absolute inset-0" style={{ backgroundColor: 'var(--brand-forest)' }} />
      )}
    </BentoCard>
  )
}
