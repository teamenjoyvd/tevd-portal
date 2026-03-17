'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { useUnreadCount } from '@/lib/hooks/useNotifications'
import { useLanguage } from '@/lib/hooks/useLanguage'
import UserDropdown from '@/components/layout/UserDropdown'

export default function Header() {
  const { isSignedIn, user } = useUser()
  const pathname = usePathname()
  const { data: unreadData } = useUnreadCount()
  const { t } = useLanguage()
  const unread = unreadData?.count ?? 0

  if (pathname?.startsWith('/sign-') || pathname?.startsWith('/admin')) return null

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname?.startsWith(href)

  const isAdmin = (user?.publicMetadata?.role as string) === 'admin'

  const NAV_LINKS = [
    { href: '/',         label: t('nav.home')     },
    { href: '/about',    label: t('nav.about')    },
    { href: '/calendar', label: t('nav.calendar') },
    { href: '/trips',    label: t('nav.trips')    },
  ]

  return (
    <header className="fixed top-4 left-0 right-0 z-50 px-4">
      <div className="max-w-[1440px] mx-auto h-14 flex items-center px-5 rounded-2xl backdrop-blur-md backdrop-saturate-150"
        style={{
          backgroundColor: 'rgba(var(--bg-global-rgb), 0.80)',
          border: '1px solid var(--border-default)',
        }}>

        {/* Left — Logo + wordmark */}
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
            TEAMENJOYVD
          </span>
        </Link>

        {/* Center — Nav links (absolute centered) */}
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
          {isAdmin && (
            <Link
              href="/admin"
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-widest uppercase transition-colors"
              style={{
                color: pathname?.startsWith('/admin') ? 'var(--brand-crimson)' : 'var(--text-secondary)',
                backgroundColor: pathname?.startsWith('/admin')
                  ? 'rgba(188,71,73,0.06)'
                  : 'transparent',
              }}
            >
              {t('nav.admin')}
            </Link>
          )}
        </nav>

        {/* Right — Bell + Avatar */}
        <div className="flex items-center gap-2 ml-auto">
          {isSignedIn ? (
            <>
              <Link
                href="/notifications"
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
              </Link>
              <UserDropdown />
            </>
          ) : (
            <Link
              href="/sign-in"
              className="px-4 py-1.5 rounded-lg text-xs font-semibold tracking-widest uppercase transition-colors"
              style={{ color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
            >
              {t('nav.signIn')}
            </Link>
          )}
        </div>

      </div>
    </header>
  )
}