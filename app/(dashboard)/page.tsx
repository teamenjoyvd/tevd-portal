import { createServiceClient } from '@/lib/supabase/service'
import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import BentoGrid from '@/components/bento/BentoGrid'
import BentoCard, { Eyebrow } from '@/components/bento/BentoCard'

type Announcement = {
  id: string; titles: Record<string, string>; contents: Record<string, string>
  is_active: boolean
}
type QuickLink = {
  id: string; label: string; url: string; icon_name: string
}
type HomeSettings = {
  show_caret_1: boolean; caret_1_text: string
  show_caret_2: boolean; caret_2_text: string
  show_caret_3: boolean; caret_3_text: string
  featured_announcement_id: string | null
}
type Trip = {
  id: string; title: string; destination: string; start_date: string
}

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatTripDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

const NAV_ITEMS = [
  { href: '/calendar',      label: 'Calendar'      },
  { href: '/trips',         label: 'Trips'         },
  { href: '/profile',       label: 'Profile'       },
  { href: '/notifications', label: 'Alerts'        },
]

export default async function HomePage() {
  let userId: string | null = null
  try {
    const session = await auth()
    userId = session.userId
  } catch {
    userId = null
  }

  const supabase = createServiceClient()
  const [settingsRes, announcementsRes, quickLinksRes, eventsRes, tripsRes] = await Promise.all([
    supabase.from('home_settings').select('*').single(),
    supabase.from('announcements').select('*').eq('is_active', true)
      .order('created_at', { ascending: false }).limit(5),
    supabase.from('quick_links').select('*').order('sort_order'),
    supabase.from('calendar_events').select('id, title, start_time, week_number')
      .eq('category', 'N21')
      .gte('start_time', new Date().toISOString())
      .order('start_time').limit(2),
    supabase.from('trips').select('id, title, destination, start_date')
      .order('start_date').limit(3),
  ])

  const settings      = settingsRes.data as HomeSettings | null
  const announcements = (announcementsRes.data ?? []) as unknown as Announcement[]
  const quickLinks    = (quickLinksRes.data ?? []) as unknown as QuickLink[]
  const nextEvents    = (eventsRes.data ?? []) as unknown as { id: string; title: string; start_time: string; week_number: number }[]
  const trips         = (tripsRes.data ?? []) as unknown as Trip[]

  const featuredAnnouncement: Announcement | null =
    settings?.featured_announcement_id
      ? (announcements.find(a => a.id === settings.featured_announcement_id) ?? announcements[0] ?? null)
      : (announcements[0] ?? null)

  const announcementTitle   = featuredAnnouncement?.titles?.en ?? featuredAnnouncement?.titles?.bg ?? null
  const announcementContent = featuredAnnouncement?.contents?.en ?? featuredAnnouncement?.contents?.bg ?? null
  const nextTrip = trips[0] ?? null

  return (
    <div style={{ backgroundColor: 'var(--bg-global)' }}>
      <BentoGrid className="py-4 pb-16">

        {/* ── 1. HERO — col 1–8, row 1–2 ── */}
        <BentoCard
          variant="forest"
          colSpan={8}
          rowSpan={2}
          className="bento-tile relative overflow-hidden"
          style={{ animationDelay: '0ms', minHeight: 380 }}
        >
          <div className="absolute inset-0 flex flex-col justify-end px-8 md:px-12 py-10 md:py-14 z-10">
            <h1
              className="font-display text-4xl md:text-6xl font-semibold leading-tight mb-3"
              style={{ color: 'var(--brand-parchment)' }}
            >
              TEAMENJOYVD
            </h1>
            <p
              className="font-body text-base md:text-lg max-w-md"
              style={{ color: 'rgba(242,239,232,0.65)' }}
            >
              Entrepreneurs, dreamers, enjoying life.
            </p>
          </div>
        </BentoCard>

        {/* ── 2. ANNOUNCEMENTS — col 9–12, row 1 ── */}
        <BentoCard
          variant="default"
          colSpan={4}
          className="bento-tile flex flex-col justify-between"
          style={{ animationDelay: '150ms' }}
        >
          <div>
            <Eyebrow>Latest</Eyebrow>
            <div className="mt-3">
              {announcementTitle ? (
                <>
                  <h2
                    className="font-display text-base font-semibold leading-snug mb-2"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {announcementTitle.split(' ').slice(0, -1).join(' ')}{' '}
                    <span style={{ color: 'var(--brand-crimson)' }}>
                      {announcementTitle.split(' ').slice(-1)[0]}
                    </span>
                  </h2>
                  {announcementContent && (
                    <p
                      className="font-body text-xs leading-relaxed"
                      style={{
                        color: 'var(--text-secondary)',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {announcementContent}
                    </p>
                  )}
                </>
              ) : (
                <p className="font-body text-xs" style={{ color: 'var(--text-secondary)' }}>
                  No announcements yet.
                </p>
              )}
            </div>
          </div>
          <Link
            href="/notifications"
            className="font-body text-[10px] font-bold tracking-widest uppercase mt-4 hover:underline self-start"
            style={{ color: 'var(--brand-crimson)' }}
          >
            View all →
          </Link>
        </BentoCard>

        {/* ── 3. NAV — col 9–12, row 2 ── */}
        <BentoCard
          variant="forest"
          colSpan={4}
          className="bento-tile flex flex-col"
          style={{ animationDelay: '230ms' }}
        >
          <Eyebrow>Navigate</Eyebrow>
          <div className="grid grid-cols-2 gap-2 mt-4 flex-1">
            {NAV_ITEMS.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="font-body flex items-center px-3 py-2.5 rounded-xl text-xs font-semibold hover:bg-white/10 transition-colors"
                style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'var(--brand-parchment)' }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </BentoCard>

        {/* ── 4. EVENTS — col 1–4, row 3 ── */}
        <BentoCard
          variant="default"
          colSpan={4}
          className="bento-tile flex flex-col"
          style={{ animationDelay: '300ms' }}
        >
          <div className="flex items-center justify-between mb-4">
            <Eyebrow>Events</Eyebrow>
            <Link
              href="/calendar"
              className="font-body text-[10px] font-bold tracking-widest uppercase hover:underline"
              style={{ color: 'var(--brand-crimson)' }}
            >
              See all →
            </Link>
          </div>
          {nextEvents.length > 0 ? (
            <div className="space-y-2 flex-1">
              {nextEvents.slice(0, 2).map(event => (
                <div
                  key={event.id}
                  className="flex items-center justify-between gap-2 py-2 border-b last:border-0"
                  style={{ borderColor: 'var(--border-default)' }}
                >
                  <div className="min-w-0">
                    <p className="font-body text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {event.title}
                    </p>
                    <p className="font-body text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {formatEventDate(event.start_time)}
                    </p>
                  </div>
                  <span
                    className="font-body text-[10px] font-bold px-2 py-0.5 rounded-lg flex-shrink-0"
                    style={{ backgroundColor: 'var(--brand-forest)', color: 'rgba(242,239,232,0.7)' }}
                  >
                    W{event.week_number}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-body text-xs flex-1 flex items-center" style={{ color: 'var(--text-secondary)' }}>
              No upcoming events.
            </p>
          )}
        </BentoCard>

        {/* ── 5. QUICK LINKS — col 5–8, row 3 ── */}
        <BentoCard
          variant="default"
          colSpan={4}
          className="bento-tile flex flex-col"
          style={{ animationDelay: '360ms' }}
        >
          <Eyebrow>Quick Access</Eyebrow>
          {quickLinks.length > 0 ? (
            <div className="grid grid-cols-2 gap-1.5 mt-4 flex-1">
              {quickLinks.slice(0, 4).map(link => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-body flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium truncate hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: 'rgba(138,133,119,0.12)', color: 'var(--text-primary)' }}
                >
                  <span style={{ color: 'var(--brand-teal)', flexShrink: 0 }}>→</span>
                  <span className="truncate">{link.label}</span>
                </a>
              ))}
            </div>
          ) : (
            <p className="font-body text-xs mt-4 flex-1 flex items-center" style={{ color: 'var(--text-secondary)' }}>
              No quick links configured.
            </p>
          )}
        </BentoCard>

        {/* ── 6. TRIPS — col 9–12, row 3 ── */}
        <BentoCard
          variant="teal"
          colSpan={4}
          className="bento-tile flex flex-col justify-between"
          style={{ animationDelay: '420ms' }}
        >
          <div>
            <Eyebrow>Trips</Eyebrow>
            {nextTrip ? (
              <div className="mt-3">
                <span
                  className="font-body text-[10px] font-bold px-2 py-0.5 rounded-full mb-2 inline-block"
                  style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'var(--brand-parchment)' }}
                >
                  {nextTrip.destination}
                </span>
                <h3
                  className="font-display text-base font-semibold leading-snug"
                  style={{ color: 'var(--brand-parchment)' }}
                >
                  {nextTrip.title}
                </h3>
                <p className="font-body text-[10px] mt-1" style={{ color: 'rgba(242,239,232,0.6)' }}>
                  {formatTripDate(nextTrip.start_date)}
                </p>
              </div>
            ) : (
              <p className="font-body text-sm font-medium mt-3" style={{ color: 'var(--brand-parchment)' }}>
                No upcoming trips.
              </p>
            )}
          </div>
          <Link
            href="/trips"
            className="font-body text-[10px] font-bold tracking-widest uppercase mt-4 hover:underline self-start opacity-70 hover:opacity-100 transition-opacity"
            style={{ color: 'var(--brand-parchment)' }}
          >
            View trips →
          </Link>
        </BentoCard>

      </BentoGrid>
    </div>
  )
}