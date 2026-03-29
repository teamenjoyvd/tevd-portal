'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

// SEQ282 — View Transitions API page transition wrapper.
// Wraps app children and triggers a cross-fade + subtle Y-slide on route change.
// Graceful degradation: browsers without startViewTransition run the update
// callback directly with no error or flash.
// Admin routes are excluded — they have heavy state mutation that fights transitions.

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

    if (!document.startViewTransition) return

    // The DOM update has already happened by the time this effect fires.
    // startViewTransition here captures the new state; the browser diffs with
    // the previous paint automatically.
    document.startViewTransition(() => {})
  }, [pathname])

  return <>{children}</>
}
