'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/admin/approval-hub',  label: 'Approval Hub'  },
  { href: '/admin/operations',    label: 'Operations'    },
  { href: '/admin/calendar',      label: 'Calendar'      },
  { href: '/admin/content',       label: 'Content'       },
  { href: '/admin/notifications', label: 'Notifications' },
  { href: '/admin/members',       label: 'Members'       },
]

export default function AdminNav() {
  const pathname = usePathname()

  const isActive = (href: string) => pathname?.startsWith(href) ?? false

  return (
    <div style={{ backgroundColor: 'var(--brand-forest)' }}>
      <div className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 h-14 flex items-center justify-center">
        <div className="flex items-center gap-1">
          {/* ADMIN label */}
          <span
            className="text-xs font-bold tracking-widest uppercase px-2 flex-shrink-0"
            style={{ color: 'rgba(255,255,255,0.35)' }}
          >
            Admin
          </span>

          {/* Pipe */}
          <span className="text-xs px-1 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>

          {/* Nav items */}
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold tracking-widest uppercase transition-colors whitespace-nowrap"
              style={{
                color: isActive(href) ? 'white' : 'rgba(255,255,255,0.7)',
                backgroundColor: isActive(href) ? 'rgba(255,255,255,0.10)' : 'transparent',
              }}
            >
              {label}
            </Link>
          ))}

          {/* Pipe */}
          <span className="text-xs px-1 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>

          {/* Portal link */}
          <Link
            href="/"
            className="flex items-center gap-1.5 px-2 text-xs font-semibold tracking-widest uppercase transition-colors hover:text-white flex-shrink-0"
            style={{ color: 'rgba(255,255,255,0.7)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Portal
          </Link>
        </div>
      </div>
    </div>
  )
}
