'use client'

import { useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

export type FontSize = 'sm' | 'md' | 'lg'

const ALLOWED: FontSize[] = ['sm', 'md', 'lg']
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

export function useFontSize(): {
  fontSize: FontSize
  setFontSize: (value: FontSize) => Promise<void>
  resetFontSize: () => Promise<void>
} {
  const queryClient = useQueryClient()

  // Profile data is already in the TanStack Query cache from the profile page / providers.
  // We read ui_prefs.font_size from it — no additional fetch.
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

  // On mount: reconcile cookie with profile value if they differ.
  // The server already stamped data-font-size from the cookie, so only
  // act when the profile source of truth disagrees (= new device scenario).
  useEffect(() => {
    const cookieVal = readCookie()
    const profileVal = profileUiPrefs?.font_size
    if (!profileVal) return
    if (!isValidFontSize(profileVal)) return
    if (profileVal !== cookieVal) {
      applyToDOM(profileVal)
      writeCookie(profileVal)
    }
  }, [profileUiPrefs])

  const setFontSize = useCallback(async (value: FontSize): Promise<void> => {
    // 1. Optimistic DOM update
    applyToDOM(value)
    // 2. Persist cookie (device-local)
    writeCookie(value)
    // 3. Dispatch for same-tab consumers
    window.dispatchEvent(new Event(DOM_EVENT))
    // 4. Sync to profile (cross-device source of truth)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ui_prefs: { font_size: value } }),
      })
      if (res.ok) {
        // Merge into local cache — don't clobber other ui_prefs keys
        queryClient.setQueryData(
          ['profile-ui-prefs-font-size'],
          (prev: { font_size?: FontSize } | undefined) => ({ ...prev, font_size: value }),
        )
      }
    } catch {
      // Network failure is silent — cookie + DOM are already correct for this device.
      // Cross-device sync will self-heal on next profile fetch.
    }
  }, [queryClient])

  const resetFontSize = useCallback((): Promise<void> => {
    return setFontSize(DEFAULT)
  }, [setFontSize])

  // Derive current value: DOM attribute is the ground truth for what's rendered.
  // Fall back to cookie, then DEFAULT.
  const fontSize: FontSize = (() => {
    if (typeof document === 'undefined') return DEFAULT
    const attr = document.documentElement.getAttribute('data-font-size')
    return isValidFontSize(attr) ? attr : readCookie()
  })()

  return { fontSize, setFontSize, resetFontSize }
}
