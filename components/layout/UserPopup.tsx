'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/hooks/useLanguage'

export default function UserPopup({ onClose }: { onClose: () => void }) {
  const { lang, toggle, t } = useLanguage()
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [onClose])

  // Focus trap: focus first focusable on mount
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
        backgroundColor: 'var(--bg-global)',
        border: '1px solid var(--border-default)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
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

      <div
        className="h-px w-full"
        style={{ backgroundColor: 'var(--border-default)' }}
      />

      <button
        onClick={toggle}
        className="flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium hover:bg-black/5 transition-colors"
        style={{ color: 'var(--text-primary)' }}
      >
        <span style={{ color: 'var(--text-secondary)' }} className="text-xs uppercase tracking-widest">
          Language
        </span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
          style={{ backgroundColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
          {lang === 'en' ? 'EN' : 'BG'}
        </span>
      </button>
    </div>
  )
}
