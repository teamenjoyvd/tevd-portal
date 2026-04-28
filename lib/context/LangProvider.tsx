'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { translate, TranslationKey, Lang } from '@/lib/i18n/translations'

const COOKIE_KEY = 'tevd_lang'

type LangContextValue = {
  lang: Lang
  toggle: () => void
  t: (key: TranslationKey) => string
}

const LangContext = createContext<LangContextValue | null>(null)

export function LangProvider({
  initialLang,
  children,
}: {
  initialLang: Lang
  children: React.ReactNode
}) {
  const [lang, setLang] = useState<Lang>(initialLang)

  const toggle = useCallback(() => {
    const next: Lang = lang === 'en' ? 'bg' : 'en'
    setLang(next)
    document.cookie = `${COOKIE_KEY}=${next}; path=/; max-age=${
      60 * 60 * 24 * 365
    }; SameSite=Lax`
  }, [lang])

  const t = useCallback(
    (key: TranslationKey) => translate(key, lang),
    [lang],
  )

  return (
    <LangContext.Provider value={{ lang, toggle, t }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used within LangProvider')
  return ctx
}
