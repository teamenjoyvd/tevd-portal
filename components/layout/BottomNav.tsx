'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser } from '@clerk/nextjs'

type NavItem = { href: string; label: string; icon: React.ReactNode }

const HomeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)
const CalendarIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
  </svg>
)
const TripIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 17h1m16 0h1M5 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0zm10 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0z"/><path d="M5 17H3v-4a2 2 0 0 1 2-2h8l3 4h2a2 2 0 0 1 2 2v0"/>
  </svg>
)
const ProfileIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
)

export default function BottomNav() {
  const { isSignedIn } = useUser()
  const pathname = usePathname()

  if (!isSignedIn) return null
  if (pathname?.startsWith('/sign-') || pathname?.startsWith('/admin')) return null

  const items: NavItem[] = [
    { href: '/',              label: 'Home',     icon: <HomeIcon />     },
    { href: '/calendar',     label: 'Calendar', icon: <CalendarIcon /> },
    { href: '/trips',        label: 'Trips',    icon: <TripIcon />     },
    { href: '/profile',      label: 'Profile',  icon: <ProfileIcon />  },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#2d332a] border-t border-white/10 md:hidden">
      <div className="grid grid-cols-4 h-16">
        {items.map(item => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href}
              className={`flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${
                active ? 'text-[#e07a5f]' : 'text-white/50 hover:text-white/80'
              }`}>
              <span className={active ? 'text-[#e07a5f]' : 'text-white/50'}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}