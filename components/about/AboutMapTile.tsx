'use client'

import { useEffect, useRef, useState } from 'react'

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
const SOFIA: [number, number] = [23.3219, 42.6977]

function getMapStyle(): string {
  const theme = document.documentElement.getAttribute('data-theme')
  return theme === 'dark'
    ? 'mapbox://styles/mapbox/dark-v11'
    : 'mapbox://styles/mapbox/light-v11'
}

export default function AboutMapTile() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<{ remove: () => void; setStyle: (s: string) => void; once: (e: string, cb: () => void) => void } | null>(null)
  const [ready, setReady] = useState(false)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    if (!TOKEN || !mapContainer.current) return

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
        zoom: 11,
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

  if (!TOKEN) {
    return (
      <div
        className="rounded-2xl flex items-end p-4"
        style={{
          gridColumn: 'span 2',
          backgroundColor: 'var(--brand-forest)',
          minHeight: 120,
        }}
      >
        <span className="text-xs font-semibold font-body" style={{ color: 'var(--brand-parchment)' }}>
          Sofia, Bulgaria
        </span>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl overflow-hidden relative"
      style={{
        gridColumn: 'span 2',
        minHeight: 120,
        backgroundColor: 'var(--brand-forest)',
      }}
    >
      <div ref={mapContainer} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* Sofia label */}
      <div
        className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
        style={{ backgroundColor: 'rgba(26,31,24,0.75)', backdropFilter: 'blur(4px)' }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
          stroke="var(--brand-parchment)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        <span className="text-[10px] font-semibold font-body" style={{ color: 'var(--brand-parchment)' }}>
          Sofia
        </span>
      </div>

      {/* Shimmer */}
      {!ready && (
        <div
          className="absolute inset-0 z-[1]"
          style={{ backgroundColor: isDark ? 'var(--brand-forest)' : '#8A8577' }}
        />
      )}
    </div>
  )
}
