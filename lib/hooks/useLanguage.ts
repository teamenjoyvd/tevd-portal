'use client'

import { useState, useEffect, useCallback } from 'react'
import { translate, TranslationKey, Lang } from '@/lib/i18n/translations'

export function useLanguage() {
  const [lang, setLang] = useState<Lang>('en')

  useEffect(() => {
    const stored = localStorage.getItem('tevd_lang') as Lang | null
    if (stored) setLang(stored)
  }, [])

  const toggle = useCallback(() => {
    setLang(prev => {
      const next = prev === 'en' ? 'bg' : 'en'
      localStorage.setItem('tevd_lang', next)
      return next
    })
  }, [])

  const t = useCallback((key: TranslationKey): string => {
    return translate(key, lang)
  }, [lang])

  return { lang, toggle, t }
}
