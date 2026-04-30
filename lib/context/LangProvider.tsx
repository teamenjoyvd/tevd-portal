'use client'

import { createContext, useContext, useState, useCallback, useMemo } from 'react'
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

  const value = useMemo(() => ({ lang, toggle, t }), [lang, toggle, t])

  return (
    <LangContext.Provider value={value}>
      {children}
    </LangContext.Provider>
  )
}

/**
 * Standard hook — throws if used outside LangProvider.
 * Use in all components guaranteed to render inside app/(dashboard)/layout.tsx.
 */
export function useLang(): LangContextValue {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used within LangProvider')
  return ctx
}

/**
 * Safe variant — returns an 'en' fallback when context is null.
 * Use ONLY in error boundaries (error.tsx), which Next.js mounts outside the
 * layout provider tree and therefore cannot access LangContext.
 */
export function useLangSafe(): LangContextValue {
  const ctx = useContext(LangContext)
  return ctx ?? {
    lang: 'en' as Lang,
    toggle: () => {},
    t: (key: TranslationKey) => translate(key, 'en'),
  }
}
