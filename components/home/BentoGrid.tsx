import Image from 'next/image'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────

type Announcement = {
  id: string
  titles: Record<string, string>
  contents: Record<string, string>
  is_active: boolean
}

type QuickLink = {
  id: string
  label: string
  url: string
  icon_name: string
}

type CalendarEvent = {
  id: string
  title: string
  start_time: string
  week_number: number
}

type Trip = {
  id: string
  title: string
  destination: string
  start_date: string
}

type BentoGridProps = {
  announcement: Announcement | null
  quickLinks: QuickLink[]
  nextEvents: CalendarEvent[]
  trips: Trip[]
  isAuthenticated: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short',
  })
}

function formatTripDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// ── Nav shortcuts ──────────────────────────────────────────────────────────

const NAV_ITEMS = [
  {
    href: '/calendar',
    label: 'Calendar',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2"/>
        <line x1="16" x2="16" y1="2" y2="6"/>
        <line x1="8" x2="8" y1="2" y2="6"/>
        <line x1="3" x2="21" y1="10" y2="10"/>
      </svg>
    ),
  },
  {
    href: '/trips',
    label: 'Trips',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      </svg>
    ),
  },
  {
    href: '/notifications',
    label: 'Notifications',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    ),
  },
]

// ── Component ──────────────────────────────────────────────────────────────

export default function BentoGrid({
  announcement,
  quickLinks,
  nextEvents,
  trips,
  isAuthenticated,
}: BentoGridProps) {
  const announcementTitle   = announcement?.titles?.en ?? announcement?.titles?.bg ?? null
  const announcementContent = announcement?.contents?.en ?? announcement?.contents?.bg ?? null
  const nextTrip = trips[0] ?? null

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

      {/* ── 1. HERO — 2×2 ──────────────────────────────────────── */}
      {/* Sequence 1: delay 0ms */}
      <div
        className="bento-tile relative md:col-span-2 md:row-span-2 rounded-3xl overflow-hidden"
        style={{ height: 380, animationDelay: '0ms' }}
      >
        <Image
          src="/hero.png"
          alt="teamenjoyVD"
          fill
          className="object-cover"
          priority
        />
        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(120deg, rgba(45,51,42,0.88) 0%, rgba(45,51,42,0.55) 60%, rgba(45,51,42,0.25) 100%)',
          }}
        />
        {/* Sienna radial accent */}
        <div
          className="absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(circle at 80% 30%, #e07a5f 0%, transparent 45%)' }}
        />
        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-end px-8 md:px-12 py-10 md:py-14 z-10">
          <h1 className="font-serif text-4xl md:text-6xl font-bold text-white leading-tight mb-3">
            TEAMENJOYVD
          </h1>
          <p className="font-sans text-base md:text-lg max-w-md"
            style={{ color: 'rgba(255,255,255,0.65)' }}>
            Entrepreneurs, dreamers, enjoying life.
          </p>
        </div>
      </div>

      {/* ── 2. ANNOUNCEMENTS — 1×1 ────────────────────────────── */}
      {/* Sequence 2: delay 150ms */}
      <div
        className="bento-tile rounded-3xl p-6 flex flex-col justify-between"
        style={{ backgroundColor: 'var(--eggshell)', border: '1px solid rgba(0,0,0,0.05)', minHeight: 180, animationDelay: '150ms' }}
      >
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase mb-3"
            style={{ color: 'var(--stone)' }}>
            Latest
          </p>
          {announcementTitle ? (
            <>
              <h2 className="font-serif text-base font-bold leading-snug mb-2"
                style={{ color: 'var(--deep)' }}>
                {announcementTitle.split(' ').slice(0, -1).join(' ')}{' '}
                <span style={{ color: 'var(--crimson)' }}>
                  {announcementTitle.split(' ').slice(-1)[0]}
                </span>
              </h2>
              {announcementContent && (
                <p className="text-xs leading-relaxed"
                  style={{
                    color: 'var(--stone)',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                  {announcementContent}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs" style={{ color: 'var(--stone)' }}>
              No announcements yet.
            </p>
          )}
        </div>
        <Link href="/notifications"
          className="text-[10px] font-bold tracking-widest uppercase mt-4 hover:underline self-start"
          style={{ color: 'var(--crimson)' }}>
          View all →
        </Link>
      </div>

      {/* ── 3. NAV — 1×1 ──────────────────────────────────────── */}
      {/* Sequence 3: delay 230ms */}
      <div
        className="bento-tile rounded-3xl p-5 flex flex-col justify-between"
        style={{ backgroundColor: 'var(--forest)', minHeight: 180, animationDelay: '230ms' }}
      >
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase mb-4"
          style={{ color: 'rgba(255,255,255,0.4)' }}>
          Navigate
        </p>
        <div className="grid grid-cols-2 gap-2 flex-1">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 px-3 py-2.5 rounded-2xl text-xs font-semibold text-white transition-colors hover:bg-white/10"
              style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}
            >
              <span style={{ color: 'var(--sienna)' }}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      {/* ── 4. EVENTS — 1×1 ───────────────────────────────────── */}
      {/* Sequence 3: delay 300ms */}
      <div
        className="bento-tile rounded-3xl p-5 flex flex-col"
        style={{ backgroundColor: 'white', border: '1px solid rgba(0,0,0,0.05)', minHeight: 180, animationDelay: '300ms' }}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase"
            style={{ color: 'var(--stone)' }}>
            Events
          </p>
          <Link href="/calendar"
            className="text-[10px] font-bold tracking-widest uppercase hover:underline"
            style={{ color: 'var(--crimson)' }}>
            See all →
          </Link>
        </div>
        {nextEvents.length > 0 ? (
          <div className="space-y-2 flex-1">
            {nextEvents.slice(0, 2).map(event => (
              <div key={event.id}
                className="flex items-center justify-between gap-2 py-2 border-b border-black/5 last:border-0">
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--deep)' }}>
                    {event.title}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--stone)' }}>
                    {formatEventDate(event.start_time)}
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg flex-shrink-0"
                  style={{ backgroundColor: 'var(--forest)', color: 'rgba(255,255,255,0.7)' }}>
                  W{event.week_number}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs flex-1 flex items-center" style={{ color: 'var(--stone)' }}>
            No upcoming events.
          </p>
        )}
      </div>

      {/* ── 5. QUICK LINKS — 1×1 ──────────────────────────────── */}
      {/* Sequence 3: delay 360ms */}
      <div
        className="bento-tile rounded-3xl p-5 flex flex-col"
        style={{ backgroundColor: 'var(--deep)', minHeight: 180, animationDelay: '360ms' }}
      >
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase mb-4"
          style={{ color: 'rgba(255,255,255,0.4)' }}>
          Quick Access
        </p>
        {quickLinks.length > 0 ? (
          <div className="grid grid-cols-2 gap-1.5 flex-1">
            {quickLinks.slice(0, 4).map(link => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-medium truncate transition-colors hover:bg-white/10"
                style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.85)' }}
              >
                <span style={{ color: 'var(--sienna)', flexShrink: 0 }}>→</span>
                <span className="truncate">{link.label}</span>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-xs flex-1 flex items-center" style={{ color: 'rgba(255,255,255,0.35)' }}>
            No quick links configured.
          </p>
        )}
      </div>

      {/* ── 6. TRIPS — 1×1 ────────────────────────────────────── */}
      {/* Sequence 3: delay 420ms */}
      <div
        className="bento-tile rounded-3xl p-5 flex flex-col justify-between"
        style={{ backgroundColor: 'var(--sienna)', minHeight: 180, animationDelay: '420ms' }}
      >
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase mb-3"
            style={{ color: 'rgba(255,255,255,0.55)' }}>
            Trips
          </p>
          {nextTrip ? (
            <>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full mb-2 inline-block"
                style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
              >
                {nextTrip.destination}
              </span>
              <h3 className="font-serif text-base font-bold text-white leading-snug">
                {nextTrip.title}
              </h3>
              <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {formatTripDate(nextTrip.start_date)}
              </p>
            </>
          ) : (
            <p className="text-sm font-medium text-white">
              No upcoming trips.
            </p>
          )}
        </div>
        <Link href="/trips"
          className="text-[10px] font-bold tracking-widest uppercase mt-4 hover:underline self-start text-white opacity-70 hover:opacity-100 transition-opacity">
          View trips →
        </Link>
      </div>

    </div>
  )
}