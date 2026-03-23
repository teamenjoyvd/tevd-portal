'use client'

import { useState, useEffect, useCallback } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'tevd-theme'

/** Apply theme to <html> and persist — safe to call from any component */
export function applyTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t)
  localStorage.setItem(STORAGE_KEY, t)
}

/**
 * Single-source-of-truth theme hook.
 * All consumers (ThemeTile, UserDropdown, UserPopup) use this.
 * Syncs across same-tab instances via a custom 'tevd-theme-change' event
 * and across tabs via the standard 'storage' event.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Read initial value — the inline script in layout.tsx will already have
    // applied it to <html>, so no flash. We just need the React state to match.
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'light'
    setTheme(stored)
    setMounted(true)

    // Same-tab sync (e.g. ThemeTile and UserDropdown both open)
    function onCustom(e: Event) {
      const next = (e as CustomEvent<Theme>).detail
      setTheme(next)
    }
    // Cross-tab sync
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY && (e.newValue === 'light' || e.newValue === 'dark')) {
        setTheme(e.newValue)
        document.documentElement.setAttribute('data-theme', e.newValue)
      }
    }

    window.addEventListener('tevd-theme-change', onCustom)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('tevd-theme-change', onCustom)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const toggle = useCallback(() => {
    const next: Theme = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    applyTheme(next)
    // Broadcast to all same-tab consumers
    window.dispatchEvent(new CustomEvent('tevd-theme-change', { detail: next }))
  }, [theme])

  return { theme, mounted, toggle }
}
