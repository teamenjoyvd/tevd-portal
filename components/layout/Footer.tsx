import Link from 'next/link'
import Image from 'next/image'

const NAV = [
  { href: '/',          label: 'Home'    },
  { href: '/about',     label: 'About'   },
  { href: '/calendar',  label: 'Calendar'},
  { href: '/trips',     label: 'Trips'   },
  { href: '/profile',   label: 'Profile' },
]

export default function Footer() {
  return (
    <footer style={{ backgroundColor: 'var(--deep)' }}>
      {/* Main footer */}
      <div className="max-w-[1280px] mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">

          {/* Col 1 — Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border border-white/20 overflow-hidden"
              >
                <Image
                  src="/logo.png"
                  alt="TEVD"
                  width={28}
                  height={28}
                  className="object-contain"
                />
              </div>
              <span className="font-serif text-base font-bold tracking-tight text-white">
                TEAMENJOYVD
              </span>
            </div>
            <p className="text-sm leading-relaxed mb-5"
              style={{ color: 'rgba(255,255,255,0.45)' }}>
              Building a culture of growth,<br />leadership, and purpose.
            </p>
            {/* Socials */}
            <div className="flex gap-3">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
                style={{ border: '1px solid rgba(255,255,255,0.15)' }}
                aria-label="Facebook"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.6)">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                </svg>
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
                style={{ border: '1px solid rgba(255,255,255,0.15)' }}
                aria-label="Instagram"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="rgba(255,255,255,0.6)" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                  <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Col 2 — Navigation */}
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-5"
              style={{ color: 'rgba(255,255,255,0.35)' }}>
              Navigation
            </p>
            <nav className="space-y-3">
              {NAV.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="block text-sm transition-colors hover:text-white"
                  style={{ color: 'rgba(255,255,255,0.6)' }}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Col 3 — Contact */}
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-5"
              style={{ color: 'rgba(255,255,255,0.35)' }}>
              Contact
            </p>
            <div className="space-y-3">
              <a
                href="mailto:teamenjoyvd@gmail.com"
                className="flex items-center gap-2.5 text-sm transition-colors hover:text-white"
                style={{ color: 'rgba(255,255,255,0.6)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
                teamenjoyvd@gmail.com
              </a>
              <div className="flex items-center gap-2.5 text-sm"
                style={{ color: 'rgba(255,255,255,0.6)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                Sofia, Bulgaria
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="max-w-[1280px] mx-auto px-6 py-4 flex items-center justify-between">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            © 2026 TEAMENJOY VD · ALL RIGHTS RESERVED
          </p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            BUILT WITH ♥ BY VERA & DENIZ
          </p>
        </div>
      </div>
    </footer>
  )
}