'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useUser } from '@clerk/nextjs'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { PUBLIC_NAV, FOOTER_MEMBER_NAV, filterNav } from '@/lib/nav'

export default function Footer() {
  const { lang } = useLanguage()
  const { user } = useUser()

  const role = user?.publicMetadata?.role as string | undefined
  const FOOTER_NAV = filterNav([...PUBLIC_NAV, ...FOOTER_MEMBER_NAV], role)

  return (
    <footer style={{ backgroundColor: 'var(--brand-forest)' }}>
      <div className="max-w-[1440px] mx-auto px-8 xl:px-12 2xl:px-16 py-8">
        {/* Mobile (<md): single flex row — brand left, socials right */}
        {/* Desktop (md+): 3-col grid */}
        <div className="flex items-center justify-between md:grid md:grid-cols-3 md:gap-8 md:items-center">

          {/* Col 1 — Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0"
              style={{ border: '1px solid rgba(255,255,255,0.15)' }}>
              <Image
                src="/logo.png"
                alt="teamenjoyVD"
                width={40}
                height={40}
                className="object-contain"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
            </div>
            <span className="font-display text-sm font-bold tracking-tight" style={{ color: 'var(--brand-parchment)' }}>
              TEAMENJOY<span style={{ color: 'var(--brand-crimson)' }}>VD</span>
            </span>
          </div>

          {/* Col 2 — Nav: hidden on mobile, single row on lg+ */}
          <nav className="hidden lg:flex flex-nowrap items-center gap-x-1 justify-center">
            {FOOTER_NAV.map(({ href, labels }) => (
              <Link
                key={href}
                href={href}
                className="pill-link-footer text-xs font-medium tracking-widest uppercase flex-shrink-0"
              >
                {labels[lang]}
              </Link>
            ))}
          </nav>

          {/* Col 3 — Socials + contact */}
          <div className="flex items-center gap-3 md:justify-end">
            <a href="https://www.instagram.com/teamenjoyvd/" target="_blank" rel="noopener noreferrer"
              aria-label="Instagram"
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
              style={{ border: '1px solid rgba(255,255,255,0.15)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="rgba(242,239,232,0.6)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
              </svg>
            </a>
            <a href="https://www.facebook.com/teamenjoyvd/" target="_blank" rel="noopener noreferrer"
              aria-label="Facebook"
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
              style={{ border: '1px solid rgba(255,255,255,0.15)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(242,239,232,0.6)">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
              </svg>
            </a>
            <a href="mailto:teamenjoyvd@gmail.com"
              aria-label="Email"
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
              style={{ border: '1px solid rgba(255,255,255,0.15)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="rgba(242,239,232,0.6)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
            </a>
          </div>

        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="max-w-[1440px] mx-auto px-8 xl:px-12 2xl:px-16 py-3 flex items-center justify-between gap-4">
          <p className="text-[11px]" style={{ color: 'rgba(242,239,232,0.3)' }}>
            © 2026 teamenjoyvd.com · All rights reserved
          </p>
          <p className="text-[11px]" style={{ color: 'rgba(242,239,232,0.3)' }}>
            Built with ♥ by Vera &amp; Deniz in Sofia.
          </p>
        </div>
      </div>
    </footer>
  )
}
