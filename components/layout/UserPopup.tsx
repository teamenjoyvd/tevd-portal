'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { useTheme } from '@/lib/hooks/useTheme'

export default function UserPopup({ onClose }: { onClose: () => void }) {
  const { lang, toggle: toggleLang, t } = useLanguage()
  const { theme, mounted: themeMounted, toggle: toggleTheme } = useTheme()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose])

  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [onClose])

  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('a,button')
    el?.focus()
  }, [])

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="Sign in or change language"
      className="absolute right-0 top-10 z-50 rounded-2xl p-4 flex flex-col gap-3"
      style={{
        minWidth: 180,
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
      }}
    >
      <Link
        href="/sign-in"
        className="flex items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
        style={{ backgroundColor: 'var(--brand-crimson)', color: 'white' }}
        onClick={onClose}
      >
        {t('nav.signIn')}
      </Link>

      <div className="h-px w-full" style={{ backgroundColor: 'var(--border-default)' }} />

      {/* Language */}
      <button
        onClick={toggleLang}
        className="flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-colors"
        style={{ color: 'var(--text-primary)' }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-global)')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <span style={{ color: 'var(--text-secondary)' }} className="text-xs uppercase tracking-widest">
          Language
        </span>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-lg"
          style={{ backgroundColor: 'var(--border-default)', color: 'var(--text-primary)' }}
        >
          {lang === 'en' ? 'EN' : 'BG'}
        </span>
      </button>

      {/* Theme */}
      <button
        onClick={toggleTheme}
        className="flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-colors"
        style={{ color: 'var(--text-primary)' }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-global)')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <span style={{ color: 'var(--text-secondary)' }} className="text-xs uppercase tracking-widest">
          Theme
        </span>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-lg"
          style={{ backgroundColor: 'var(--border-default)', color: 'var(--text-primary)' }}
        >
          {!themeMounted ? '\u2026' : theme === 'light' ? '\uD83C\uDF19' : '\u2600\uFE0F'}
        </span>
      </button>
    </div>
  )
}
