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

  // Don't show on auth pages or admin
  if (pathname?.startsWith('/sign-') || pathname?.startsWith('/admin')) return null

  return (
    <header className="sticky top-0 z-40 bg-[#2d332a] text-white px-4 py-3 flex items-center justify-between">
      <Link href="/" className="font-serif text-lg tracking-wide">
        teamenjoyVD
      </Link>

      <div className="flex items-center gap-3">
        {isSignedIn ? (
          <>
            {/* Bell */}
            <Link href="/notifications" className="relative p-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                className="text-white/70 hover:text-white transition-colors">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-[#bc4749] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </Link>
            <UserButton afterSignOutUrl="/" />
          </>
        ) : (
          <Link href="/sign-in"
            className="text-sm text-white/70 hover:text-white transition-colors">
            Sign in
          </Link>
        )}
      </div>
    </header>
  )
}