import { createServiceClient } from '@/lib/supabase/service'
import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import BentoGrid from '@/components/bento/BentoGrid'
import BentoCard, { Eyebrow } from '@/components/bento/BentoCard'
import ProfileTile from '@/app/(dashboard)/components/tiles/ProfileTile'
import LinksGuidesTile from '@/app/(dashboard)/components/tiles/LinksGuidesTile'
import LocationTile from '@/app/(dashboard)/components/tiles/LocationTileLazy'
import ThemeTile from '@/app/(dashboard)/components/tiles/ThemeTile'
import FontSizeTile from '@/app/(dashboard)/components/tiles/FontSizeTile'
import SocialsTile from '@/app/(dashboard)/components/tiles/SocialsTile'
import { formatDate, formatTime, calDay, calMonth } from '@/lib/format'

export const dynamic = 'force-dynamic'

type Announcement = {
  id: string; titles: Record<string, string>; contents: Record<string, string>
  is_active: boolean
}
type QuickLink = { id: string; label: string; url: string; icon_name: string }
type Trip = { id: string; title: string; destination: string; start_date: string; image_url: string | null }

const EVENT_TYPE_LABELS: Record<string, string> = {
  'in-person': 'In-Person',
  'online': 'Online',
  'hybrid': 'Hybrid',
}

function normaliseUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return '#'
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function eventDuration(startIso: string, endIso: string | null | undefined): string {
  if (!endIso) return ''
  const diffMs = new Date(endIso).getTime() - new Date(startIso).getTime()
  if (diffMs <= 0) return ''
  const totalMins = Math.round(diffMs / 60000)
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
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
    supabase.from('quick_links').select('*').contains('access_level', [role]).order('sort_order').limit(6),
    supabase.from('calendar_events').select('id, title, start_time, end_time, week_number, event_type')
      .contains('visibility_roles', [role]).gte('start_time', new Date().toISOString()).order('start_time').limit(3),
    supabase.from('trips').select('id, title, destination, start_date, image_url')
      .contains('visibility_roles', [role]).order('start_date').limit(3),
  ])

  const announcements = (announcementsRes.data ?? []) as unknown as Announcement[]
  const quickLinks    = (quickLinksRes.data ?? []) as unknown as QuickLink[]
  const nextEvents    = (eventsRes.data ?? []) as unknown as { id: string; title: string; start_time: string; end_time: string | null; week_number: number; event_type: string | null }[]
  const trips         = (tripsRes.data ?? []) as unknown as Trip[]

  const featuredAnnouncement = announcements[0] ?? null
  const announcementTitle   = featuredAnnouncement?.titles?.en ?? featuredAnnouncement?.titles?.bg ?? null
  const announcementContent = featuredAnnouncement?.contents?.en ?? featuredAnnouncement?.contents?.bg ?? null
  const nextTrip = trips[0] ?? null

  return (
    <div style={{ backgroundColor: 'var(--bg-global)' }}>
      <BentoGrid className="py-4 pb-16">

        {/* ── ROW 1: Hero col-6 | Events col-4 | Profile col-2 ── */}

        <BentoCard variant="forest" colSpan={6} mobileColSpan={12} rowSpan={2} className="bento-tile relative overflow-hidden" style={{ animationDelay: '0ms', minHeight: 320 }}>
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

        {nextEvents.length > 0 && (
        <BentoCard variant="default" colSpan={4} mobileColSpan={12} rowSpan={2} className="bento-tile flex flex-col" style={{ animationDelay: '150ms' }}>
          <div className="flex items-center justify-between mb-4">
            <Eyebrow>Events</Eyebrow>
            <Link href="/calendar" className="font-body text-[11px] font-bold tracking-widest uppercase hover:underline" style={{ color: 'var(--brand-crimson)' }}>See all →</Link>
          </div>
          <div className="flex flex-col gap-3 flex-1">
            {nextEvents.slice(0, 3).map(event => {
              const duration = eventDuration(event.start_time, event.end_time)
              const typeParts = [
                event.event_type ? (EVENT_TYPE_LABELS[event.event_type] ?? event.event_type) : null,
                formatTime(event.start_time),
                duration || null,
              ].filter(Boolean).join(' · ')

              return (
                <Link
                  key={event.id}
                  href={`/calendar?event=${event.id}`}
                  className="flex items-center justify-between gap-3 py-2 border-b last:border-0 hover:opacity-70 transition-opacity"
                  style={{ borderColor: 'var(--border-default)', textDecoration: 'none' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>{event.title}</p>
                    {typeParts && (
                      <p className="font-body text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {typeParts}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-center flex-shrink-0 rounded-lg overflow-hidden" style={{ width: 40 }}>
                    <div className="w-full text-center py-0.5" style={{ backgroundColor: 'var(--brand-crimson)', flex: '0 0 33%' }}>
                      <span className="text-[8px] font-bold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.9)' }}>
                        {calMonth(event.start_time)}
                      </span>
                    </div>
                    <div className="w-full text-center" style={{ backgroundColor: 'var(--bg-card)', flex: '0 0 67%', paddingTop: 3, paddingBottom: 4 }}>
                      <span className="font-display text-2xl font-bold leading-none" style={{ color: 'var(--brand-crimson)' }}>
                        {calDay(event.start_time)}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </BentoCard>
        )}

        <ProfileTile colSpan={2} mobileColSpan={6} rowSpan={2} />

        {/* ── ROW 2: Trips col-3 | Announcements col-6 | Theme col-3 | FontSize col-3 ── */}

        {nextTrip && (
        <BentoCard variant="crimson" colSpan={3} mobileColSpan={6} rowSpan={2} className="bento-tile relative overflow-hidden p-0" style={{ animationDelay: '200ms' }}>
          {nextTrip.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={nextTrip.image_url}
              alt=""
              aria-hidden="true"
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                objectFit: 'cover', opacity: 0.45, pointerEvents: 'none',
              }}
            />
          )}
          <div className="absolute top-0 left-0 right-0 flex items-start justify-between px-5 pt-5 z-10">
            <span
              className="font-body text-[11px] font-bold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: 'var(--brand-parchment)' }}
            >
              {nextTrip.destination}
            </span>
            <Link
              href="/trips"
              className="font-body text-[11px] font-bold tracking-widest uppercase hover:underline transition-opacity hover:opacity-100"
              style={{ color: 'var(--brand-parchment)', opacity: 0.75 }}
            >
              View trips →
            </Link>
          </div>
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 z-10">
            <h3
              className="font-display text-2xl font-semibold leading-tight"
              style={{ color: 'var(--brand-parchment)' }}
            >
              {nextTrip.title}
            </h3>
            <p
              className="font-body text-[12px] mt-1"
              style={{ color: 'rgba(242,239,232,0.65)' }}
            >
              {formatDate(nextTrip.start_date)}
            </p>
          </div>
        </BentoCard>
        )}

        {featuredAnnouncement && (
        <BentoCard variant="default" colSpan={6} mobileColSpan={12} rowSpan={2} className="bento-tile flex flex-col" style={{ animationDelay: '250ms' }}>
          <div className="flex items-center justify-between mb-4">
            <Eyebrow>Latest</Eyebrow>
            <Link href="/announcements" className="font-body text-[11px] font-bold tracking-widest uppercase hover:underline" style={{ color: 'var(--brand-crimson)' }}>View all →</Link>
          </div>
          <div className="flex-1">
            <h2 className="font-display text-xl font-semibold leading-snug mb-2" style={{ color: 'var(--text-primary)' }}>
              {announcementTitle!.split(' ').slice(0, -1).join(' ')}{' '}
              <span style={{ color: 'var(--brand-crimson)' }}>{announcementTitle!.split(' ').slice(-1)[0]}</span>
            </h2>
            {announcementContent && (
              <p className="font-body text-sm leading-relaxed" style={{ color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
                {announcementContent}
              </p>
            )}
          </div>
        </BentoCard>
        )}

        <ThemeTile colSpan={3} mobileColSpan={6} rowSpan={2} />
        <FontSizeTile colSpan={3} mobileColSpan={6} rowSpan={2} />

        {/* ── ROW 3: Socials col-4 | Map col-3 | About Us col-2 | LinksGuides col-3 ── */}

        <SocialsTile colSpan={4} mobileColSpan={6} rowSpan={2} />

        <LocationTile colSpan={3} mobileColSpan={6} rowSpan={2} />

        <BentoCard variant="default" colSpan={2} mobileColSpan={6} rowSpan={2} className="bento-tile flex flex-col" style={{ animationDelay: '450ms' }}>
          <div className="flex items-center justify-between mb-4">
            <Eyebrow>About Us</Eyebrow>
            <Link href="/about" className="font-body text-[11px] font-bold tracking-widest uppercase hover:underline" style={{ color: 'var(--brand-crimson)' }}>Our story →</Link>
          </div>
          <div className="flex-1">
            <h2 className="font-display text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Hey there!</h2>
            <p className="font-body text-sm leading-relaxed" style={{ color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
              We&apos;re Vera &amp; Deniz, two folks living it up in Sofia, Bulgaria. All about good vibes, meaningful connections, and building rock-solid relationships.
            </p>
          </div>
        </BentoCard>

        <LinksGuidesTile quickLinks={quickLinks} colSpan={3} mobileColSpan={6} rowSpan={2} />

      </BentoGrid>
    </div>
  )
}
