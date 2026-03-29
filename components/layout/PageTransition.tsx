'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

// SEQ283 — View Transitions API page transition wrapper.
// Triggers a scale-fade on route change with shared element support for the
// trips flow (trip-image-{id} morph on available/pending states).
// Graceful degradation: browsers without startViewTransition run the update
// callback directly with no error or flash.
// Exclusions:
//   - Initial mount (no animation on first load)
//   - /admin routes (heavy state mutation fights transitions)
//   - Landscape mobile <1024px (jank risk on low-end devices)

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isFirstRender = useRef(true)

  useEffect(() => {
    // Skip the initial mount — only animate on subsequent navigations
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    // Skip admin routes — they manage their own re-render cycles
    if (pathname?.startsWith('/admin')) return

    // Skip landscape mobile — low-end devices struggle with the screenshot
    // buffer in landscape; fall through to instant render instead
    if (
      window.innerWidth < 1024 &&
      window.matchMedia('(orientation: landscape)').matches
    ) return

    if (!document.startViewTransition) return

    document.startViewTransition(() => {})
  }, [pathname])

  return <>{children}</>
}
