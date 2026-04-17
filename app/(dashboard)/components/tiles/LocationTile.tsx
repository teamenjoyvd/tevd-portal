'use client'

import { useEffect, useRef, useState } from 'react'
import BentoCard from '@/components/bento/BentoCard'

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
const SOFIA: [number, number] = [23.3219, 42.6977]
const LIGHT_SHIMMER = '#8A8577'

function getMapStyle(theme: string | null): string {
  return theme === 'dark'
    ? 'mapbox://styles/mapbox/dark-v11'
    : 'mapbox://styles/mapbox/light-v11'
}

function LocationFallback({
  colSpan,
  mobileColSpan,
  rowSpan,
  style,
}: {
  colSpan: number
  mobileColSpan?: number
  rowSpan?: number
  style?: React.CSSProperties
}) {
  return (
    <BentoCard variant="forest" colSpan={colSpan} mobileColSpan={mobileColSpan} rowSpan={rowSpan}
      className="relative flex items-end"
      style={{ border: 'none', ...style }}>
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

export default function LocationTile({
  colSpan = 6,
  mobileColSpan = 12,
  rowSpan,
  style,
}: {
  colSpan?: number
  mobileColSpan?: number
  rowSpan?: number
  style?: React.CSSProperties
}) {
  const { theme, mounted } = useTheme()
  const isDark = mounted ? theme === 'dark' : false
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<{ remove: () => void; setStyle: (s: string) => void; once: (e: string, cb: () => void) => void } | null>(null)
  const [ready, setReady] = useState(false)

  // Initialization
  useEffect(() => {
    if (!TOKEN || !mapContainer.current) return

    function initMap() {
      if (!mapContainer.current) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapboxgl = (window as any).mapboxgl
      if (!mapboxgl) return
      mapboxgl.accessToken = TOKEN
      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: getMapStyle(theme),
        center: SOFIA,
        zoom: 12,
        interactive: false,
        attributionControl: false,
      })
      mapRef.current = map
      map.on('load', () => setReady(true))
    }

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

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, []) // Empty deps for single initialization

  // Theme update
  useEffect(() => {
    if (mapRef.current && mounted) {
      setReady(false)
      mapRef.current.setStyle(getMapStyle(theme))
      mapRef.current.once('styledata', () => setReady(true))
    }
  }, [theme, mounted])

  if (!TOKEN) return <LocationFallback colSpan={colSpan} mobileColSpan={mobileColSpan} rowSpan={rowSpan} style={style} />

  return (
    <BentoCard variant="forest" colSpan={colSpan} mobileColSpan={mobileColSpan} rowSpan={rowSpan}
      className="relative overflow-hidden p-0"
      style={{ minHeight: 200, border: 'none', ...style }}>
      <div ref={mapContainer} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

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

      {!ready && (
        <div className="absolute inset-0 z-[1]"
          style={{ backgroundColor: isDark ? 'var(--brand-forest)' : LIGHT_SHIMMER }} />
      )}
    </BentoCard>
  )
}
