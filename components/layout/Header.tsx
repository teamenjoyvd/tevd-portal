'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser, UserButton } from '@clerk/nextjs'
import { useUnreadCount } from '@/lib/hooks/useNotifications'

export default function Header() {
  const { isSignedIn } = useUser()
  const pathname = usePathname()
  const { data } = useUnreadCount()
  const unread = data?.count ?? 0

  if (pathname?.startsWith('/sign-') || pathname?.startsWith('/admin')) return null

  return (
    <header
      className="sticky top-0 z-40 px-4 h-14 flex items-center justify-between border-b border-white/10"
      style={{ backgroundColor: 'var(--forest)' }}
    >
      <Link
        href="/"
        className="font-serif text-xl font-bold tracking-tight"
        style={{ color: 'var(--eggshell)' }}
      >
        tēVD
      </Link>

      <div className="flex items-center gap-3">
        {isSignedIn ? (
          <>
            <Link href="/notifications" className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="rgba(255,255,255,0.7)" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {unread > 0 && (
                <span
                  className="absolute top-1 right-1 min-w-[16px] h-4 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1"
                  style={{ backgroundColor: 'var(--crimson)' }}
                >
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </Link>
            <UserButton appearance={{
              elements: {
                avatarBox: 'w-8 h-8',
              }
            }} />
          </>
        ) : (
          <Link
            href="/sign-in"
            className="text-sm font-medium px-4 py-1.5 rounded-full transition-colors"
            style={{ color: 'var(--eggshell)', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  )
}