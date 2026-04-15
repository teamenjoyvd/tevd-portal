'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ADMIN_NAV } from '@/lib/nav'
import { useLanguage } from '@/lib/hooks/useLanguage'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

export default function AdminNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const { lang, t } = useLanguage()

  const isActive = (href: string) => pathname?.startsWith(href) ?? false

  return (
    <div style={{ backgroundColor: 'var(--brand-forest)' }}>
      <div className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 h-14 flex items-center">

        {/* ── DESKTOP (lg+) ──────────────────────────────────────────── */}
        <div className="hidden lg:flex items-center gap-1 w-full justify-center">
          {/* ADMIN label */}
          <span
            className="text-xs font-bold tracking-widest uppercase px-2 flex-shrink-0"
            style={{ color: 'rgba(255,255,255,0.35)' }}
          >
            {t('nav.admin')}
          </span>

          {/* Pipe */}
          {/* eslint-disable-next-line i18next/no-literal-string */}
          {/* reason: decorative punctuation, not UI copy */}
          <span className="text-xs px-1 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>

          {/* Nav items */}
          {ADMIN_NAV.map(({ href, labels }) => (
            <Link
              key={href}
              href={href}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold tracking-widest uppercase transition-colors whitespace-nowrap"
              style={{
                color: isActive(href) ? 'white' : 'rgba(255,255,255,0.7)',
                backgroundColor: isActive(href) ? 'rgba(255,255,255,0.10)' : 'transparent',
              }}
            >
              {labels[lang]}
            </Link>
          ))}

          {/* Pipe */}
          {/* eslint-disable-next-line i18next/no-literal-string */}
          {/* reason: decorative punctuation, not UI copy */}
          <span className="text-xs px-1 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>

          {/* Portal link */}
          <Link
            href="/"
            className="flex items-center gap-1.5 px-2 text-xs font-semibold tracking-widest uppercase transition-colors hover:text-white flex-shrink-0"
            style={{ color: 'rgba(255,255,255,0.7)' }}
          >
            {t('admin.nav.portal')}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </Link>
        </div>

        {/* ── MOBILE (<lg) ───────────────────────────────────────────── */}
        <div className="flex lg:hidden items-center justify-between w-full">
          <span
            className="text-xs font-bold tracking-widest uppercase"
            style={{ color: 'rgba(255,255,255,0.35)' }}
          >
            {t('nav.admin')}
          </span>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                aria-label={t('admin.nav.openMenu')}
                className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
                style={{ color: 'rgba(255,255,255,0.7)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <line x1="3" y1="12" x2="21" y2="12"/>
                  <line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>
            </SheetTrigger>

            <SheetContent side="right" style={{ backgroundColor: 'var(--brand-forest)', borderColor: 'rgba(255,255,255,0.1)' }}>
              <SheetHeader>
                <SheetTitle
                  className="text-xs font-bold tracking-widest uppercase"
                  style={{ color: 'rgba(255,255,255,0.35)' }}
                >
                  {t('nav.admin')}
                </SheetTitle>
              </SheetHeader>

              <nav className="flex flex-col gap-1 mt-6">
                {ADMIN_NAV.map(({ href, labels }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className="px-3 py-2.5 rounded-lg text-xs font-semibold tracking-widest uppercase transition-colors"
                    style={{
                      color: isActive(href) ? 'white' : 'rgba(255,255,255,0.7)',
                      backgroundColor: isActive(href) ? 'rgba(255,255,255,0.10)' : 'transparent',
                    }}
                  >
                    {labels[lang]}
                  </Link>
                ))}

                <div className="my-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }} />

                <Link
                  href="/"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-widest uppercase transition-colors"
                  style={{ color: 'rgba(255,255,255,0.7)' }}
                >
                  {t('admin.nav.portal')}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>

      </div>
    </div>
  )
}
