'use client'

import { useEffect, useState } from 'react'
import BentoCard from '@/components/bento/BentoCard'
import { Eyebrow } from '@/components/bento/BentoCard'

export default function ThemeTile({ colSpan = 2, rowSpan, halfWidthMobile }: { colSpan?: number; rowSpan?: number; halfWidthMobile?: boolean }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [mounted, setMounted] = useState(false)

  // SSR-safe: read localStorage only after mount
  useEffect(() => {
    const stored = localStorage.getItem('tevd-theme') as 'light' | 'dark' | null
    const initial = stored ?? 'light'
    setTheme(initial)
    document.documentElement.setAttribute('data-theme', initial)
    setMounted(true)
  }, [])

  function toggle() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('tevd-theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  const mobileClass = halfWidthMobile ? ' bento-mobile-half' : ''

  return (
    <div style={{ gridColumn: `span ${colSpan}`, ...(rowSpan ? { gridRow: `span ${rowSpan}` } : {}) }}
      className={`cursor-pointer select-none hover:brightness-95 active:scale-[0.98] transition-all${mobileClass}`}
      onClick={toggle}>
      <BentoCard variant="default"
        className="flex flex-col items-center justify-center text-center h-full"
        style={{ minHeight: 120 }}>
      <div className="mb-3">
        {!mounted ? (
          <div className="w-10 h-10 rounded-full animate-pulse mx-auto"
            style={{ backgroundColor: 'var(--border-default)' }} />
        ) : theme === 'light' ? (
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
            stroke="var(--brand-crimson)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
          </svg>
        ) : (
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
            stroke="var(--brand-teal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
          </svg>
        )}
      </div>
      <Eyebrow>{!mounted ? '…' : theme === 'light' ? 'Light' : 'Dark'}</Eyebrow>
      </BentoCard>
    </div>
  )
}
