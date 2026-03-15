'use client'

import { useState, useEffect, useCallback } from 'react'

export function useLanguage() {
  const [lang, setLang] = useState<'en' | 'bg'>('en')

  useEffect(() => {
    const stored = localStorage.getItem('tevd_lang') as 'en' | 'bg' | null
    if (stored) setLang(stored)
  }, [])

  const toggle = useCallback(() => {
    setLang(prev => {
      const next = prev === 'en' ? 'bg' : 'en'
      localStorage.setItem('tevd_lang', next)
      return next
    })
  }, [])

  return { lang, toggle }
}