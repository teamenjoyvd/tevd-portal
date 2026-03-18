'use client'

import { useState, useEffect, useCallback } from 'react'
import { translate, TranslationKey, Lang } from '@/lib/i18n/translations'

const LANG_KEY = 'tevd_lang'
const LANG_EVENT = 'language-changed'

export function useLanguage() {
  const [lang, setLang] = useState<Lang>('en')

  useEffect(() => {
    const stored = localStorage.getItem(LANG_KEY) as Lang | null
    if (stored) setLang(stored)

    function handleChange() {
      const updated = localStorage.getItem(LANG_KEY) as Lang | null
      if (updated) setLang(updated)
    }

    window.addEventListener(LANG_EVENT, handleChange)
    return () => window.removeEventListener(LANG_EVENT, handleChange)
  }, [])

  const toggle = useCallback(() => {
    setLang(prev => {
      const next = prev === 'en' ? 'bg' : 'en'
      localStorage.setItem(LANG_KEY, next)
      window.dispatchEvent(new Event(LANG_EVENT))
      return next
    })
  }, [])

  const t = useCallback((key: TranslationKey): string => {
    return translate(key, lang)
  }, [lang])

  return { lang, toggle, t }
}
