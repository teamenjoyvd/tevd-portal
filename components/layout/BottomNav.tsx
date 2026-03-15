'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser } from '@clerk/nextjs'

export default function BottomNav() {
  const { isSignedIn } = useUser()
  const pathname = usePathname()

  if (!isSignedIn) return null
  if (pathname?.startsWith('/sign-') || pathname?.startsWith('/admin')) return null

  const items = [
    {
      href: '/', label: 'Home',
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'var(--sienna)' : 'none'}
          stroke={active ? 'var(--sienna)' : 'rgba(255,255,255,0.4)'}
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      ),
    },
    {
      href: '/calendar', label: 'Calendar',
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke={active ? 'var(--sienna)' : 'rgba(255,255,255,0.4)'}
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/>
          <line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
        </svg>
      ),
    },
    {
      href: '/trips', label: 'Trips',
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke={active ? 'var(--sienna)' : 'rgba(255,255,255,0.4)'}
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      ),
    },
    {
      href: '/profile', label: 'Profile',
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke={active ? 'var(--sienna)' : 'rgba(255,255,255,0.4)'}
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        </svg>
      ),
    },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 md:hidden"
      style={{ backgroundColor: 'var(--forest)' }}
    >
      <div className="grid grid-cols-4 h-16 max-w-xl mx-auto">
        {items.map(item => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center gap-1 transition-opacity active:opacity-60"
            >
              {item.icon(active)}
              <span
                className="text-[10px] font-medium"
                style={{ color: active ? 'var(--sienna)' : 'rgba(255,255,255,0.4)' }}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}