'use client'

import { useSyncExternalStore, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

export type FontSize = 'sm' | 'md' | 'lg' | 'xl'

const ALLOWED: FontSize[] = ['sm', 'md', 'lg', 'xl']
const DEFAULT: FontSize = 'md'
const COOKIE_KEY = 'tevd-font-size'
const DOM_EVENT = 'tevd-font-size-change'

function isValidFontSize(v: unknown): v is FontSize {
  return ALLOWED.includes(v as FontSize)
}

function readCookie(): FontSize {
  if (typeof document === 'undefined') return DEFAULT
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${COOKIE_KEY}=`))
  const val = match?.split('=')[1]
  return isValidFontSize(val) ? val : DEFAULT
}

function writeCookie(value: FontSize): void {
  document.cookie = `${COOKIE_KEY}=${value}; path=/; max-age=31536000; SameSite=Lax`
}

function applyToDOM(value: FontSize): void {
  document.documentElement.setAttribute('data-font-size', value)
}

// External store: subscribe to the tevd-font-size-change window event.
function subscribe(callback: () => void): () => void {
  window.addEventListener(DOM_EVENT, callback)
  return () => window.removeEventListener(DOM_EVENT, callback)
}

// getSnapshot: read DOM attribute, fall back to cookie.
function getSnapshot(): FontSize {
  const attr = document.documentElement.getAttribute('data-font-size')
  return isValidFontSize(attr) ? attr : readCookie()
}

// getServerSnapshot: no DOM access permitted on the server.
function getServerSnapshot(): FontSize {
  return DEFAULT
}

export function useFontSize(): {
  fontSize: FontSize
  setFontSize: (value: FontSize) => Promise<void>
  resetFontSize: () => Promise<void>
} {
  const queryClient = useQueryClient()

  const fontSize = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const { data: profileUiPrefs } = useQuery<{ font_size?: FontSize } | undefined>({
    queryKey: ['profile-ui-prefs-font-size'],
    queryFn: async () => {
      const res = await fetch('/api/profile')
      if (!res.ok) return undefined
      const json = await res.json() as { ui_prefs?: { font_size?: FontSize } }
      return json.ui_prefs
    },
    staleTime: Infinity,
  })

  // Profile sync: when the server value differs from the local cookie, apply it
  // and notify all store subscribers so useSyncExternalStore re-reads.
  useEffect(() => {
    const cookieVal = readCookie()
    const profileVal = profileUiPrefs?.font_size
    if (!profileVal) return
    if (!isValidFontSize(profileVal)) return
    if (profileVal !== cookieVal) {
      applyToDOM(profileVal)
      writeCookie(profileVal)
      window.dispatchEvent(new Event(DOM_EVENT))
    }
  }, [profileUiPrefs])

  const setFontSize = useCallback(async (value: FontSize): Promise<void> => {
    applyToDOM(value)
    writeCookie(value)
    window.dispatchEvent(new Event(DOM_EVENT))
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ui_prefs: { font_size: value } }),
      })
      if (res.ok) {
        queryClient.setQueryData(
          ['profile-ui-prefs-font-size'],
          (prev: { font_size?: FontSize } | undefined) => ({ ...prev, font_size: value }),
        )
      }
    } catch {
      // Silent — cookie + DOM already correct for this device.
    }
  }, [queryClient])

  const resetFontSize = useCallback((): Promise<void> => {
    return setFontSize(DEFAULT)
  }, [setFontSize])

  return { fontSize, setFontSize, resetFontSize }
}
