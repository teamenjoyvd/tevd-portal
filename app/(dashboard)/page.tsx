import { createServiceClient } from '@/lib/supabase/service'
import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import BentoGrid from '@/components/bento/BentoGrid'
import BentoCard from '@/components/bento/BentoCard'
import ProfileTile from '@/app/(dashboard)/components/tiles/ProfileTile'
import LinksGuidesTile from '@/app/(dashboard)/components/tiles/LinksGuidesTile'
import LocationTile from '@/app/(dashboard)/components/tiles/LocationTileLazy'
import ThemeTile from '@/app/(dashboard)/components/tiles/ThemeTile'
import FontSizeTile from '@/app/(dashboard)/components/tiles/FontSizeTile'
import SocialsTile from '@/app/(dashboard)/components/tiles/SocialsTile'
import CalendarTile from '@/app/(dashboard)/components/tiles/CalendarTile'
import { formatDate } from '@/lib/format'

export const dynamic = 'force-dynamic'

type Announcement = {
  id: string; titles: Record<string, string>; contents: Record<string, string>
  is_active: boolean
}
type SiteLink = { id: string; label: { en: string; bg: string }; url: string }
type Guide = { id: string; slug: string; title: { en: string; bg: string }; emoji: string | null }
type Trip = { id: string; title: string; destination: string; start_date: string; image_url: string | null }
type CalendarEvent = { id: string; title: string; start_time: string; end_time: string | null; event_type: string | null }

export default async function HomePage() {
  let userId: string | null = null
  try { const session = await auth(); userId = session.userId } catch { userId = null }

  const supabase = createServiceClient()
  let role = 'guest'
  if (userId) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('clerk_id', userId).single()
    if (profile?.role) role = profile.role
  }

  const [announcementsRes, linksRes, tripsRes, guidesRes, eventsRes] = await Promise.all([
    supabase.from('announcements').select('*').eq('is_active', true)
      .contains('access_level', [role]).order('created_at', { ascending: false }).limit(5),
    supabase.from('links').select('id, label, url').contains('access_roles', [role]).order('sort_order').limit(4),
    supabase.from('trips').select('id, title, destination, start_date, image_url')
      .contains('visibility_roles', [role]).order('start_date').limit(3),
    supabase.from('guides').select('id, slug, title, emoji')
      .eq('is_published', true).contains('access_roles', [role])
      .order('created_at', { ascending: false }).limit(4),
    supabase.from('calendar_events')
      .select('id, title, start_time, end_time, event_type')
      .contains('visibility_roles', [role])
      .gte('start_time', new Date().toISOString())
      .order('start_time')
      .limit(3),
  ])

  const announcements  = (announcementsRes.data ?? []) as unknown as Announcement[]
  const links          = (linksRes.data ?? []) as unknown as SiteLink[]
  const trips          = (tripsRes.data ?? []) as unknown as Trip[]
  const guides         = (guidesRes.data ?? []) as unknown as Guide[]
  const events         = (eventsRes.data ?? []) as unknown as CalendarEvent[]

  const featuredAnnouncement = announcements[0] ?? null
  const announcementTitle   = featuredAnnouncement?.titles?.en ?? featuredAnnouncement?.titles?.bg ?? null
  const announcementContent = featuredAnnouncement?.contents?.en ?? featuredAnnouncement?.contents?.bg ?? null
  const nextTrip = trips[0] ?? null

  // ── Shared card content (rendered in both layouts) ──────────────────────

  const heroContent = (
    <>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 40% 50%, rgba(188,71,73,0.18) 0%, transparent 70%)' }} />
      <div className="absolute inset-0 flex flex-col justify-end px-8 py-10 z-10">
        <h1 className="font-display text-4xl font-semibold leading-tight mb-3" style={{ color: 'var(--brand-parchment)' }}>
          TEAMENJOYVD
        </h1>
        <p className="font-body text-base max-w-xs" style={{ color: 'rgba(242,239,232,0.65)' }}>
          Entrepreneurs, dreamers, enjoying life.
        </p>
      </div>
    </>
  )

  const aboutContent = (
    <>
      <div className="flex items-center justify-end mb-4">
        <Link href="/about" className="font-body text-[11px] font-bold tracking-widest uppercase pill-link-crimson">
          About us →
        </Link>
      </div>
      <div className="flex-1">
        <h2 className="font-display text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Hey there!</h2>
        <p className="font-body text-sm leading-relaxed" style={{ color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
          We&apos;re Vera &amp; Deniz, two folks living it up in Sofia, Bulgaria. All about good vibes, meaningful connections, and building rock-solid relationships.
        </p>
      </div>
    </>
  )

  const announcementContent2 = featuredAnnouncement ? (
    <>
      <div className="flex items-center justify-end mb-4">
        <Link href="/announcements" className="font-body text-[11px] font-bold tracking-widest uppercase pill-link-crimson">
          View all →
        </Link>
      </div>
      <div className="flex-1">
        <h2 className="font-display text-xl font-semibold leading-snug mb-2" style={{ color: 'var(--text-primary)' }}>
          {announcementTitle}
        </h2>
        {announcementContent && (
          <p className="font-body text-sm leading-relaxed" style={{ color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
            {announcementContent}
          </p>
        )}
      </div>
    </>
  ) : null

  const tripContent = nextTrip ? (
    <>
      {nextTrip.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={nextTrip.image_url}
          alt=""
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.45, pointerEvents: 'none' }}
        />
      )}
      <div className="absolute top-0 left-0 right-0 flex items-start justify-end px-5 pt-5 z-10">
        <Link href="/trips" className="font-body text-[11px] font-bold tracking-widest uppercase pill-link-parchment">
          Trips →
        </Link>
      </div>
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 z-10">
        <h3 className="font-display text-2xl font-semibold leading-tight" style={{ color: 'var(--brand-parchment)' }}>{nextTrip.title}</h3>
        <div className="flex items-center gap-2 mt-1">
          <span className="font-body text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: 'var(--brand-parchment)' }}>
            {nextTrip.destination}
          </span>
          <p className="font-body text-[12px]" style={{ color: 'rgba(242,239,232,0.65)' }}>{formatDate(nextTrip.start_date)}</p>
        </div>
      </div>
    </>
  ) : null

  return (
    <div style={{ backgroundColor: 'var(--bg-global)' }}>

      {/* ── DESKTOP (md+) ────────────────────────────────────────────────── */}
      <div className="hidden md:block">
        <BentoGrid className="py-4 pb-16">

          <BentoCard
            variant="forest"
            colSpan={6}
            rowSpan={2}
            className="bento-tile relative overflow-hidden"
            style={{ gridColumn: '1 / span 6', gridRow: '1 / span 2', animationDelay: '0ms' }}
          >
            {heroContent}
          </BentoCard>

          <BentoCard
            variant="default"
            colSpan={3}
            rowSpan={1}
            className="bento-tile flex flex-col"
            style={{ gridColumn: '7 / span 3', gridRow: '1 / span 1', animationDelay: '100ms' }}
          >
            {aboutContent}
          </BentoCard>

          <CalendarTile
            events={events}
            colSpan={3}
            rowSpan={2}
            style={{ gridColumn: '10 / span 3', gridRow: '1 / span 2' }}
          />

          <LinksGuidesTile
            links={links}
            guides={guides}
            colSpan={3}
            rowSpan={2}
            style={{ gridColumn: '7 / span 3', gridRow: '2 / span 2' }}
          />

          {featuredAnnouncement && (
            <BentoCard
              variant="default"
              colSpan={3}
              rowSpan={1}
              className="bento-tile flex flex-col"
              style={{ gridColumn: '1 / span 3', gridRow: '3 / span 1', animationDelay: '250ms' }}
            >
              {announcementContent2}
            </BentoCard>
          )}

          <LocationTile
            colSpan={3}
            rowSpan={1}
            style={{ gridColumn: '4 / span 3', gridRow: '3 / span 1' }}
          />

          <ProfileTile
            colSpan={3}
            rowSpan={1}
            style={{ gridColumn: '10 / span 3', gridRow: '3 / span 1' }}
          />

          {nextTrip && (
            <BentoCard
              variant="crimson"
              colSpan={3}
              rowSpan={1}
              className="bento-tile relative overflow-hidden p-0"
              style={{ gridColumn: '1 / span 3', gridRow: '4 / span 1', animationDelay: '200ms' }}
            >
              {tripContent}
            </BentoCard>
          )}

          <SocialsTile
            colSpan={3}
            rowSpan={1}
            style={{ gridColumn: '4 / span 3', gridRow: '4 / span 1' }}
          />

          <FontSizeTile
            colSpan={3}
            rowSpan={1}
            style={{ gridColumn: '7 / span 3', gridRow: '4 / span 1' }}
          />

          <ThemeTile
            colSpan={3}
            rowSpan={1}
            style={{ gridColumn: '10 / span 3', gridRow: '4 / span 1' }}
          />

        </BentoGrid>
      </div>

      {/* ── MOBILE (< md) ────────────────────────────────────────────────── */}
      <div className="md:hidden flex flex-col gap-3 px-4 py-4 pb-24">

        <BentoCard variant="forest" className="relative overflow-hidden" style={{ minHeight: 200 }}>
          {heroContent}
        </BentoCard>

        <ProfileTile />

        <CalendarTile events={events} />

        {nextTrip && (
          <BentoCard variant="crimson" className="relative overflow-hidden p-0" style={{ minHeight: 180 }}>
            {tripContent}
          </BentoCard>
        )}

        {featuredAnnouncement && (
          <BentoCard variant="default" className="flex flex-col">
            {announcementContent2}
          </BentoCard>
        )}

        <LinksGuidesTile links={links} guides={guides} />

        <BentoCard variant="default" className="flex flex-col">
          {aboutContent}
        </BentoCard>

        <LocationTile style={{ minHeight: 200 }} />

        <div className="grid grid-cols-2 gap-3">
          <ThemeTile />
          <FontSizeTile />
        </div>

        <SocialsTile />

      </div>

    </div>
  )
}
