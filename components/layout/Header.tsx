'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { useLanguage } from '@/lib/hooks/useLanguage'
import UserDropdown from '@/components/layout/UserDropdown'
import UserPopup from '@/components/layout/UserPopup'
import BellButton from '@/components/layout/BellButton'
import { PUBLIC_NAV, MEMBER_NAV, filterNav } from '@/lib/nav'

export default function Header() {
  const { isSignedIn, user } = useUser()
  const pathname = usePathname()
  const { lang } = useLanguage()
  const [guestPopupOpen, setGuestPopupOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileNavOpen(false)
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [])

  if (pathname?.startsWith('/sign-') || pathname?.startsWith('/admin')) return null

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname?.startsWith(href)

  const role = user?.publicMetadata?.role as string | undefined

  // Header shows library + profile for members, but not /los
  const NAV_LINKS = filterNav(
    [...PUBLIC_NAV, ...MEMBER_NAV.filter(item => item.href !== '/los')],
    role
  )

  return (
    <header className="fixed top-4 left-0 right-0 z-50 px-4">
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="max-w-[1440px] mx-auto relative z-50">
        <div className="h-14 flex items-center px-5 rounded-2xl backdrop-blur-md backdrop-saturate-150"
          style={{
            backgroundColor: 'rgba(var(--bg-global-rgb), 0.80)',
            border: '1px solid var(--nav-border)',
          }}>

          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 interactive">
            <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
              style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
              <Image
                src="/logo.png"
                alt="teamenjoyVD"
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
            <span
              className="font-display text-base font-bold tracking-tight hidden sm:block"
              style={{ color: 'var(--brand-forest)' }}
            >
              TEAMENJOY<span style={{ color: 'var(--brand-crimson)' }}>VD</span>
            </span>
          </Link>

          {/* Desktop nav — lg+ only (1024px+) so landscape phones use the hamburger */}
          <nav className="hidden lg:flex items-center gap-0.5 absolute left-1/2 -translate-x-1/2">
            {NAV_LINKS.map(({ href, labels }) => (
              <Link
                key={href}
                href={href}
                className="interactive pill-link-crimson text-xs font-semibold tracking-widest uppercase"
                style={isActive(href) ? { backgroundColor: 'rgba(188,71,73,0.12)' } : undefined}
              >
                {labels[lang]}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 ml-auto">
            {/* Hamburger — visible below lg (covers portrait + landscape phones, portrait tablet) */}
            <button
              className="interactive lg:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors"
              onClick={() => setMobileNavOpen(o => !o)}
              aria-label="Toggle navigation"
              aria-expanded={mobileNavOpen}
            >
              {mobileNavOpen ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="var(--text-nav)" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="var(--text-nav)" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <line x1="3" y1="12" x2="21" y2="12"/>
                  <line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              )}
            </button>

            {isSignedIn ? (
              <>
                {/* BellButton owns useUnreadCount (→ useQuery → useMemo).
                    Suspense isolates it from the prerender pass, preventing
                    React #310 on SSR routes like /profile. */}
                <Suspense fallback={<div className="w-8 h-8" />}>
                  <BellButton />
                </Suspense>
                <UserDropdown />
              </>
            ) : (
              <UserPopup
                open={guestPopupOpen}
                onOpenChange={setGuestPopupOpen}
                trigger={
                  <button
                    aria-label="Sign in or change language"
                    className="interactive w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                      stroke="var(--text-nav)" strokeWidth="1.8"
                      strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="8" r="4"/>
                      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                    </svg>
                  </button>
                }
              />
            )}
          </div>

        </div>

        {/* Mobile/tablet drawer — visible below lg */}
        {mobileNavOpen && (
          <div
            className="lg:hidden mt-2 rounded-2xl py-2 px-3"
            style={{
              backgroundColor: 'rgba(var(--bg-global-rgb), 0.97)',
              border: '1px solid var(--nav-border)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {NAV_LINKS.map(({ href, labels }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileNavOpen(false)}
                className="interactive flex items-center pill-link-crimson text-xs font-semibold tracking-widest uppercase"
                style={isActive(href) ? { backgroundColor: 'rgba(188,71,73,0.12)' } : undefined}
              >
                {labels[lang]}
              </Link>
            ))}
          </div>
        )}
      </div>
    </header>
  )
}
