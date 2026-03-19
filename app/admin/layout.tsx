import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('clerk_id', userId).single()

  if (profile?.role !== 'admin') redirect('/')

  const PRIMARY_NAV = [
    { href: '/admin/approval-hub', label: 'Approval Hub' },
    { href: '/admin/operations',   label: 'Operations'   },
    { href: '/admin/calendar',     label: 'Calendar'     },
    { href: '/admin/content',      label: 'Content'      },
    { href: '/admin/guides',       label: 'Guides'       },
    { href: '/admin/notifications', label: 'Notifications' },
  ]

  const PEOPLE_NAV = [
    { href: '/admin/members',     label: 'Members'     },
    { href: '/admin/los',         label: 'LOS Tree'    },
    { href: '/admin/data-center', label: 'Data Center' },
  ]

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-card)' }}>
      <div style={{ backgroundColor: 'var(--brand-forest)' }}>
        <div className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 h-14 flex items-center gap-6">
          <span className="font-display font-bold text-sm tracking-widest uppercase text-white flex-shrink-0">
            Admin
          </span>
          <nav className="flex items-center gap-1 flex-1 overflow-x-auto">
            {PRIMARY_NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold tracking-widest uppercase transition-colors hover:bg-white/10 whitespace-nowrap"
                style={{ color: 'rgba(255,255,255,0.7)' }}
              >
                {label}
              </Link>
            ))}
            <span className="mx-1 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
            <span className="text-[10px] font-semibold tracking-widest uppercase flex-shrink-0 px-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
              People
            </span>
            {PEOPLE_NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold tracking-widest uppercase transition-colors hover:bg-white/10 whitespace-nowrap"
                style={{ color: 'rgba(255,255,255,0.7)' }}
              >
                {label}
              </Link>
            ))}
          </nav>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase transition-colors hover:text-white flex-shrink-0"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Portal
          </Link>
        </div>
      </div>
      <main className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
