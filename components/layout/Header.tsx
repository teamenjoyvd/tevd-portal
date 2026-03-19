'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { useUnreadCount } from '@/lib/hooks/useNotifications'
import { useLanguage } from '@/lib/hooks/useLanguage'
import UserDropdown from '@/components/layout/UserDropdown'
import UserPopup from '@/components/layout/UserPopup'
import NotificationPopup from '@/components/notifications/NotificationPopup'

export default function Header() {
  const { isSignedIn, user } = useUser()
  const pathname = usePathname()
  const { data: unreadData } = useUnreadCount()
  const { t } = useLanguage()
  const unread = unreadData?.count ?? 0
  const [bellOpen, setBellOpen] = useState(false)
  const [guestPopupOpen, setGuestPopupOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)
  const guestRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

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

  const isNonGuest = !!user && (user?.publicMetadata?.role as string) !== 'guest'

  const NAV_LINKS = [
    { href: '/',         label: t('nav.home')     },
    { href: '/about',    label: t('nav.about')    },
    { href: '/calendar', label: t('nav.calendar') },
    { href: '/trips',    label: t('nav.trips')    },
    ...(isNonGuest ? [{ href: '/guides',  label: t('nav.howtos')  }] : []),
    ...(isNonGuest ? [{ href: '/profile', label: t('nav.profile') }] : []),
  ]

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
            border: '1px solid var(--border-default)',
          }}>

          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
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

          <nav className="hidden md:flex items-center gap-0.5 absolute left-1/2 -translate-x-1/2">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-widest uppercase transition-colors"
                style={{
                  color: isActive(href) ? 'var(--brand-crimson)' : 'var(--text-secondary)',
                  backgroundColor: isActive(href) ? 'rgba(188,71,73,0.06)' : 'transparent',
                }}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 ml-auto">
            <button
              className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors"
              onClick={() => setMobileNavOpen(o => !o)}
              aria-label="Toggle navigation"
              aria-expanded={mobileNavOpen}
            >
              {mobileNavOpen ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="var(--text-secondary)" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="var(--text-secondary)" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <line x1="3" y1="12" x2="21" y2="12"/>
                  <line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              )}
            </button>

            {isSignedIn ? (
              <>
                <div ref={bellRef} className="relative">
                  <button
                    onClick={() => setBellOpen(o => !o)}
                    className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors"
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                      stroke="var(--text-secondary)" strokeWidth="1.8"
                      strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                    {unread > 0 && (
                      <span
                        className="absolute top-0.5 right-0.5 min-w-[15px] h-[15px] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1"
                        style={{ backgroundColor: 'var(--brand-crimson)' }}
                      >
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </button>
                  {bellOpen && <NotificationPopup onClose={() => setBellOpen(false)} />}
                </div>
                <UserDropdown />
              </>
            ) : (
              <div ref={guestRef} className="relative">
                <button
                  onClick={() => setGuestPopupOpen(o => !o)}
                  aria-label="Sign in or change language"
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="var(--text-secondary)" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="4"/>
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                  </svg>
                </button>
                {guestPopupOpen && (
                  <UserPopup onClose={() => setGuestPopupOpen(false)} />
                )}
              </div>
            )}
          </div>

        </div>

        {mobileNavOpen && (
          <div
            className="md:hidden mt-2 rounded-2xl py-2 px-3"
            style={{
              backgroundColor: 'rgba(var(--bg-global-rgb), 0.97)',
              border: '1px solid var(--border-default)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileNavOpen(false)}
                className="flex items-center px-3 py-2.5 rounded-xl text-xs font-semibold tracking-widest uppercase transition-colors"
                style={{
                  color: isActive(href) ? 'var(--brand-crimson)' : 'var(--text-secondary)',
                  backgroundColor: isActive(href) ? 'rgba(188,71,73,0.06)' : 'transparent',
                }}
              >
                {label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </header>
  )
}
