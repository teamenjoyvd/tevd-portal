'use client'

import { useSyncExternalStore, useCallback } from 'react'
import { translate, TranslationKey, Lang } from '@/lib/i18n/translations'

const COOKIE_KEY = 'tevd_lang'
const LANG_EVENT = 'language-changed'
const DEFAULT: Lang = 'en'

function getCookieLang(): Lang {
  if (typeof document === 'undefined') return DEFAULT
  const match = document.cookie
    .split('; ')
    .find(row => row.startsWith(`${COOKIE_KEY}=`))
  const value = match?.split('=')[1]
  return value === 'bg' ? 'bg' : DEFAULT
}

function setCookieLang(lang: Lang): void {
  // 1-year expiry, path=/ so all routes see it
  document.cookie = `${COOKIE_KEY}=${lang}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(LANG_EVENT, callback)
  return () => window.removeEventListener(LANG_EVENT, callback)
}

export function useLanguage() {
  const lang = useSyncExternalStore(
    subscribe,
    getCookieLang,
    () => DEFAULT, // getServerSnapshot — SSR always gets default
  )

  const toggle = useCallback(() => {
    const next: Lang = getCookieLang() === 'en' ? 'bg' : 'en'
    setCookieLang(next)
    window.dispatchEvent(new Event(LANG_EVENT))
  }, [])

  const t = useCallback((key: TranslationKey): string => {
    return translate(key, lang)
  }, [lang])

  return { lang, toggle, t }
}
