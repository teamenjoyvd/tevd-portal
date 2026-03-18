'use client'

import { useEffect, useRef, useState } from 'react'
import BentoCard from '@/components/bento/BentoCard'

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
const SOFIA: [number, number] = [23.3219, 42.6977]
// #8A8577 = brand-stone, used as the light-mode shimmer placeholder
const LIGHT_SHIMMER = '#8A8577'

function getMapStyle(): string {
  const theme = document.documentElement.getAttribute('data-theme')
  return theme === 'dark'
    ? 'mapbox://styles/mapbox/dark-v11'
    : 'mapbox://styles/mapbox/light-v11'
}

function LocationFallback({ colSpan, rowSpan, halfWidthMobile }: { colSpan: number; rowSpan?: number; halfWidthMobile?: boolean }) {
  return (
    <BentoCard variant="forest" colSpan={colSpan} rowSpan={rowSpan} halfWidthMobile={halfWidthMobile} className="relative flex items-end">
      <div className="absolute inset-0 flex items-center justify-center opacity-10">
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none"
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

export default function LocationTile({ colSpan = 6, rowSpan, halfWidthMobile }: { colSpan?: number; rowSpan?: number; halfWidthMobile?: boolean }) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<{ remove: () => void; setStyle: (s: string) => void; once: (e: string, cb: () => void) => void } | null>(null)
  const [ready, setReady] = useState(false)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    if (!TOKEN || !mapContainer.current) return

    // Read initial theme
    setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')

    function initMap() {
      if (!mapContainer.current) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapboxgl = (window as any).mapboxgl
      if (!mapboxgl) return
      mapboxgl.accessToken = TOKEN
      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: getMapStyle(),
        center: SOFIA,
        zoom: 12,
        interactive: false,
        attributionControl: false,
      })
      mapRef.current = map
      map.on('load', () => setReady(true))
    }

    // Inject CSS first so it's available when map renders
    if (!document.querySelector('link[href*="mapbox-gl"]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css'
      document.head.appendChild(link)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).mapboxgl) {
      initMap()
    } else if (!document.querySelector('script[src*="mapbox-gl"]')) {
      const script = document.createElement('script')
      script.src = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js'
      script.onload = initMap
      document.head.appendChild(script)
    } else {
      const existing = document.querySelector('script[src*="mapbox-gl"]')!
      existing.addEventListener('load', initMap, { once: true })
    }

    // Watch for theme changes and swap map style + shimmer colour
    const observer = new MutationObserver(() => {
      const dark = document.documentElement.getAttribute('data-theme') === 'dark'
      setIsDark(dark)
      if (mapRef.current) {
        setReady(false)
        mapRef.current.setStyle(getMapStyle())
        mapRef.current.once('styledata', () => setReady(true))
      }
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    return () => {
      observer.disconnect()
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  if (!TOKEN) return <LocationFallback colSpan={colSpan} rowSpan={rowSpan} halfWidthMobile={halfWidthMobile} />

  return (
    <BentoCard variant="forest" colSpan={colSpan} rowSpan={rowSpan} halfWidthMobile={halfWidthMobile}
      className="relative overflow-hidden p-0"
      style={{ minHeight: 200 }}>
      {/* Map container — must have explicit dimensions */}
      <div ref={mapContainer} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

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

      {/* Shimmer until map tiles load — dark-forest for dark, brand-stone (#8A8577) for light */}
      {!ready && (
        <div className="absolute inset-0 z-[1]"
          style={{ backgroundColor: isDark ? 'var(--brand-forest)' : LIGHT_SHIMMER }} />
      )}
    </BentoCard>
  )
}
