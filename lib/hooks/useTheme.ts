'use client'

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'tevd-theme'

/** Apply theme to <html> and persist — safe to call from any component */
export function applyTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t)
  localStorage.setItem(STORAGE_KEY, t)
}

function subscribe(callback: () => void) {
  if (typeof window === 'undefined') return () => {}

  const onCustom = () => callback()
  const onStorage = (e: StorageEvent) => {
    // eslint-disable-next-line i18next/no-literal-string
    if (e.key === STORAGE_KEY && (e.newValue === 'light' || e.newValue === 'dark')) {
      document.documentElement.setAttribute('data-theme', e.newValue)
    }
    callback()
  }

  window.addEventListener('tevd-theme-change', onCustom)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener('tevd-theme-change', onCustom)
    window.removeEventListener('storage', onStorage)
  }
}

function getSnapshot() {
  if (typeof window === 'undefined') return 'light'
  return (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'light'
}

function getServerSnapshot() {
  return 'light' as Theme
}

/**
 * Single-source-of-truth theme hook.
 * All consumers (ThemeTile, UserDropdown, UserPopup) use this.
 * Syncs across same-tab instances via a custom 'tevd-theme-change' event
 * and across tabs via the standard 'storage' event.
 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const toggle = useCallback(() => {
    // eslint-disable-next-line i18next/no-literal-string
    const next: Theme = theme === 'light' ? 'dark' : 'light'
    applyTheme(next)
    window.dispatchEvent(new CustomEvent('tevd-theme-change', { detail: next }))
  }, [theme])

  return { theme, mounted, toggle }
}
