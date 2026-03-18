import { createServiceClient } from '@/lib/supabase/service'
import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import BentoGrid from '@/components/bento/BentoGrid'
import BentoCard, { Eyebrow } from '@/components/bento/BentoCard'
import ProfileTile from '@/components/bento/tiles/ProfileTile'
import HowtosTile from '@/components/bento/tiles/HowtosTile'
import LocationTile from '@/components/bento/tiles/LocationTile'
import ThemeTile from '@/components/bento/tiles/ThemeTile'
import SocialsTile from '@/components/bento/tiles/SocialsTile'

type Announcement = {
  id: string; titles: Record<string, string>; contents: Record<string, string>
  is_active: boolean
}
type QuickLink = { id: string; label: string; url: string; icon_name: string }
type Trip = { id: string; title: string; destination: string; start_date: string; image_url: string | null }

function formatTripDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// iOS-style calendar date square helpers
function calDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric' })
}
function calMonth(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()
}
function calTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  'in-person': 'In-Person',
  'online': 'Online',
  'hybrid': 'Hybrid',
}

export default async function HomePage() {
  let userId: string | null = null
  try { const session = await auth(); userId = session.userId } catch { userId = null }

  const supabase = createServiceClient()
  let role = 'guest'
  if (userId) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('clerk_id', userId).single()
    if (profile?.role) role = profile.role
  }

  const [announcementsRes, quickLinksRes, eventsRes, tripsRes] = await Promise.all([
    supabase.from('announcements').select('*').eq('is_active', true)
      .contains('access_level', [role]).order('created_at', { ascending: false }).limit(5),
    supabase.from('quick_links').select('*').contains('access_level', [role]).order('sort_order').limit(4),
    supabase.from('calendar_events').select('id, title, start_time, week_number, event_type')
      .contains('visibility_roles', [role]).gte('start_time', new Date().toISOString()).order('start_time').limit(3),
    supabase.from('trips').select('id, title, destination, start_date, image_url')
      .contains('visibility_roles', [role]).order('start_date').limit(3),
  ])

  const announcements = (announcementsRes.data ?? []) as unknown as Announcement[]
  const quickLinks    = (quickLinksRes.data ?? []) as unknown as QuickLink[]
  const nextEvents    = (eventsRes.data ?? []) as unknown as { id: string; title: string; start_time: string; week_number: number; event_type: string | null }[]
  const trips         = (tripsRes.data ?? []) as unknown as Trip[]

  const featuredAnnouncement = announcements[0] ?? null
  const announcementTitle   = featuredAnnouncement?.titles?.en ?? featuredAnnouncement?.titles?.bg ?? null
  const announcementContent = featuredAnnouncement?.contents?.en ?? featuredAnnouncement?.contents?.bg ?? null
  const nextTrip = trips[0] ?? null

  return (
    <div style={{ backgroundColor: 'var(--bg-global)' }}>
      <BentoGrid className="py-4 pb-16">

        {/* ── ROW 1: Hero col-6 | Profile col-2 | Events col-4 ── */}

        <BentoCard variant="forest" colSpan={6} rowSpan={2} fullWidthMobile className="bento-tile relative overflow-hidden" style={{ animationDelay: '0ms', minHeight: 320 }}>
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 40% 50%, rgba(188,71,73,0.18) 0%, transparent 70%)' }} />
          <div className="absolute inset-0 flex flex-col justify-end px-8 py-10 z-10">
            <h1 className="font-display text-4xl md:text-5xl font-semibold leading-tight mb-3" style={{ color: 'var(--brand-parchment)' }}>
              TEAMENJOYVD
            </h1>
            <p className="font-body text-base max-w-xs" style={{ color: 'rgba(242,239,232,0.65)' }}>
              Entrepreneurs, dreamers, enjoying life.
            </p>
          </div>
        </BentoCard>

        <ProfileTile colSpan={2} rowSpan={2} halfWidthMobile />

        {nextEvents.length > 0 && (
        <BentoCard variant="default" colSpan={4} rowSpan={2} fullWidthMobile className="bento-tile flex flex-col" style={{ animationDelay: '150ms' }}>
          <div className="flex items-center justify-between mb-4">
            <Eyebrow>Events</Eyebrow>
            <Link href="/calendar" className="font-body text-[11px] font-bold tracking-widest uppercase hover:underline" style={{ color: 'var(--brand-crimson)' }}>See all →</Link>
          </div>
          <div className="flex flex-col gap-3 flex-1">
            {nextEvents.slice(0, 3).map(event => (
              <div key={event.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0" style={{ borderColor: 'var(--border-default)' }}>
                {/* Left: name + type */}
                <div className="flex-1 min-w-0">
                  <p className="font-body text-xs font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>{event.title}</p>
                  {event.event_type && (
                    <span className="inline-block mt-1 font-body text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--text-secondary)' }}>
                      {EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}
                    </span>
                  )}
                </div>
                {/* Right: iOS date square + time */}
                <div className="flex flex-col items-center flex-shrink-0" style={{ minWidth: 40 }}>
                  <div className="rounded-lg overflow-hidden flex flex-col items-center" style={{ width: 40, backgroundColor: 'var(--brand-crimson)' }}>
                    <div className="w-full text-center py-0.5" style={{ backgroundColor: 'var(--brand-crimson)', opacity: 0.85 }}>
                      <span className="text-[8px] font-bold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.9)' }}>
                        {calMonth(event.start_time)}
                      </span>
                    </div>
                    <div className="w-full text-center pb-1" style={{ backgroundColor: 'var(--bg-card)' }}>
                      <span className="font-display text-xl font-bold leading-none" style={{ color: 'var(--brand-crimson)' }}>
                        {calDay(event.start_time)}
                      </span>
                    </div>
                  </div>
                  <span className="font-body text-[9px] font-medium mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {calTime(event.start_time)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </BentoCard>
        )}

        {/* ── ROW 2: Trips col-3 | Announcements col-6 | Links col-3 ── */}

        {nextTrip && (
        <BentoCard variant="crimson" colSpan={3} rowSpan={2} halfWidthMobile className="bento-tile flex flex-col justify-between relative overflow-hidden" style={{ animationDelay: '200ms' }}>
          {nextTrip.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={nextTrip.image_url}
              alt=""
              aria-hidden="true"
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                objectFit: 'cover', opacity: 0.22, pointerEvents: 'none',
              }}
            />
          )}
          <div>
            <Eyebrow>Trips</Eyebrow>
            <div className="mt-3">
              <span className="font-body text-[11px] font-bold px-2 py-0.5 rounded-full mb-2 inline-block" style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: 'var(--brand-parchment)' }}>{nextTrip.destination}</span>
              <h3 className="font-display text-base font-semibold leading-snug" style={{ color: 'var(--brand-parchment)' }}>{nextTrip.title}</h3>
              <p className="font-body text-[11px] mt-1" style={{ color: 'rgba(242,239,232,0.6)' }}>{formatTripDate(nextTrip.start_date)}</p>
            </div>
          </div>
          <Link href="/trips" className="font-body text-[11px] font-bold tracking-widest uppercase mt-4 hover:underline self-start opacity-70 hover:opacity-100 transition-opacity" style={{ color: 'var(--brand-parchment)' }}>View trips →</Link>
        </BentoCard>
        )}

        {featuredAnnouncement && (
        <BentoCard variant="default" colSpan={6} rowSpan={2} fullWidthMobile className="bento-tile flex flex-col justify-between" style={{ animationDelay: '250ms' }}>
          <div>
            <Eyebrow>Latest</Eyebrow>
            <div className="mt-3">
              <h2 className="font-display text-xl font-semibold leading-snug mb-2" style={{ color: 'var(--text-primary)' }}>
                {announcementTitle!.split(' ').slice(0, -1).join(' ')}{' '}
                <span style={{ color: 'var(--brand-crimson)' }}>{announcementTitle!.split(' ').slice(-1)[0]}</span>
              </h2>
              {announcementContent && (
                <p className="font-body text-sm leading-relaxed" style={{ color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {announcementContent}
                </p>
              )}
            </div>
          </div>
          <Link href="/announcements" className="font-body text-[11px] font-bold tracking-widest uppercase mt-4 hover:underline self-start" style={{ color: 'var(--brand-crimson)' }}>View all →</Link>
        </BentoCard>
        )}

        {quickLinks.length > 0 && (
        <BentoCard variant="teal" colSpan={3} rowSpan={2} halfWidthMobile className="bento-tile flex flex-col" style={{ animationDelay: '300ms' }}>
          <div className="flex items-center justify-between mb-4">
            <Eyebrow style={{ color: 'var(--brand-parchment)' }}>Quick Access</Eyebrow>
            <Link href="/links" className="font-body text-[11px] font-bold tracking-widest uppercase hover:underline" style={{ color: 'var(--brand-parchment)', opacity: 0.7 }}>All →</Link>
          </div>
          <div className="flex flex-col gap-1.5 flex-1">
            {quickLinks.map(link => (
              <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                className="font-body flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium truncate hover:opacity-80 transition-opacity"
                style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: 'var(--brand-parchment)' }}>
                <span style={{ flexShrink: 0, opacity: 0.7 }}>→</span>
                <span className="truncate">{link.label}</span>
              </a>
            ))}
          </div>
        </BentoCard>
        )}

        {/* ── ROW 3: Socials col-4 | Theme col-2 | Map col-3 | About Us col-3 ── */}

        <SocialsTile colSpan={4} rowSpan={2} halfWidthMobile />

        <ThemeTile colSpan={2} rowSpan={2} halfWidthMobile />

        <LocationTile colSpan={3} rowSpan={2} halfWidthMobile />

        <BentoCard variant="default" colSpan={3} rowSpan={2} halfWidthMobile className="bento-tile flex flex-col justify-between" style={{ animationDelay: '450ms' }}>
          <div>
            <Eyebrow>About Us</Eyebrow>
            <h2 className="font-display text-xl font-semibold mt-3 mb-3" style={{ color: 'var(--text-primary)' }}>Hey there!</h2>
            <p className="font-body text-sm leading-relaxed" style={{ color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              We&apos;re Vera &amp; Deniz, two folks living it up in Sofia, Bulgaria. All about good vibes, meaningful connections, and building rock-solid relationships.
            </p>
          </div>
          <Link href="/about" className="font-body text-[11px] font-bold tracking-widest uppercase mt-4 hover:underline self-start" style={{ color: 'var(--brand-crimson)' }}>Our story →</Link>
        </BentoCard>

        {/* ── ROW 4: Howtos col-12 ── */}

        <HowtosTile colSpan={12} rowSpan={2} halfWidthMobile />

      </BentoGrid>
    </div>
  )
}
