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
import CalendarTile from '@/app/(dashboard)/components/tiles/CalendarTile'
import { formatDate } from '@/lib/format'

export const dynamic = 'force-dynamic'

type Announcement = {
  id: string; titles: Record<string, string>; contents: Record<string, string>
  is_active: boolean
}
type SiteLink = { id: string; label: { en: string; bg: string }; url: string }
type Trip = { id: string; title: string; destination: string; start_date: string; image_url: string | null }

export default async function HomePage() {
  let userId: string | null = null
  try { const session = await auth(); userId = session.userId } catch { userId = null }

  const supabase = createServiceClient()
  let role = 'guest'
  if (userId) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('clerk_id', userId).single()
    if (profile?.role) role = profile.role
  }

  const [announcementsRes, linksRes, tripsRes] = await Promise.all([
    supabase.from('announcements').select('*').eq('is_active', true)
      .contains('access_level', [role]).order('created_at', { ascending: false }).limit(5),
    supabase.from('links').select('id, label, url').contains('access_roles', [role]).order('sort_order').limit(4),
    supabase.from('trips').select('id, title, destination, start_date, image_url')
      .contains('visibility_roles', [role]).order('start_date').limit(3),
  ])

  const announcements = (announcementsRes.data ?? []) as unknown as Announcement[]
  const links         = (linksRes.data ?? []) as unknown as SiteLink[]
  const trips         = (tripsRes.data ?? []) as unknown as Trip[]

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
      <div className="flex items-center justify-between mb-4">
        <Link href="/about" className="font-body text-[11px] font-bold tracking-widest uppercase hover:underline" style={{ color: 'var(--brand-crimson)' }}>About us →</Link>
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
      <div className="absolute top-0 left-0 right-0 flex items-start justify-between px-5 pt-5 z-10">
        <span className="font-body text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: 'var(--brand-parchment)' }}>
          {nextTrip.destination}
        </span>
        <Link href="/trips" className="font-body text-[11px] font-bold tracking-widest uppercase hover:opacity-70 transition-opacity" style={{ color: 'var(--brand-parchment)' }}>
          Trips →
        </Link>
      </div>
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 z-10">
        <h3 className="font-display text-2xl font-semibold leading-tight" style={{ color: 'var(--brand-parchment)' }}>{nextTrip.title}</h3>
        <p className="font-body text-[12px] mt-1" style={{ color: 'rgba(242,239,232,0.65)' }}>{formatDate(nextTrip.start_date)}</p>
      </div>
    </>
  ) : null

  return (
    <div style={{ backgroundColor: 'var(--bg-global)' }}>

      {/* ── DESKTOP (md+) ────────────────────────────────────────────────── */}
      <div className="hidden md:block">
        <BentoGrid className="py-4 pb-16">

          {/* ROW 1: Hero·6(rows1–2) | About·3(row1) | Events·3(rows1–2) */}

          <BentoCard
            variant="forest"
            colSpan={6}
            rowSpan={2}
            className="bento-tile relative overflow-hidden"
            style={{ gridColumn: '1 / span 6', gridRow: '1 / span 2', animationDelay: '0ms' }}
          >
            {heroContent}
          </BentoCard>

          {/* About: col 7–9, row 1 */}
          <BentoCard
            variant="default"
            colSpan={3}
            rowSpan={1}
            className="bento-tile flex flex-col"
            style={{ gridColumn: '7 / span 3', gridRow: '1 / span 1', animationDelay: '100ms' }}
          >
            {aboutContent}
          </BentoCard>

          {/* Events: col 10–12, rows 1–2 */}
          <CalendarTile
            colSpan={3}
            rowSpan={2}
            style={{ gridColumn: '10 / span 3', gridRow: '1 / span 2' }}
          />

          {/* ROW 2: Hero cont. | LinksGuides·3(rows2–3) | Events cont. */}

          <LinksGuidesTile
            links={links}
            colSpan={3}
            rowSpan={2}
            style={{ gridColumn: '7 / span 3', gridRow: '2 / span 2' }}
          />

          {/* ROW 3: Trips·3 | Announce·3 | LinksGuides cont. | Profile·3 */}

          {nextTrip && (
            <BentoCard
              variant="crimson"
              colSpan={3}
              rowSpan={1}
              className="bento-tile relative overflow-hidden p-0"
              style={{ gridColumn: '1 / span 3', gridRow: '3 / span 1', animationDelay: '200ms' }}
            >
              {tripContent}
            </BentoCard>
          )}

          {featuredAnnouncement && (
            <BentoCard
              variant="default"
              colSpan={3}
              rowSpan={1}
              className="bento-tile flex flex-col"
              style={{ gridColumn: '4 / span 3', gridRow: '3 / span 1', animationDelay: '250ms' }}
            >
              {announcementContent2}
            </BentoCard>
          )}

          {/* Profile: col 10–12, row 3 */}
          <ProfileTile
            colSpan={3}
            rowSpan={1}
            style={{ gridColumn: '10 / span 3', gridRow: '3 / span 1' }}
          />

          {/* ROW 4: Map·3 | Socials·3 | FontSize·3 | Theme·3 */}

          <LocationTile
            colSpan={3}
            rowSpan={1}
            style={{ gridColumn: '1 / span 3', gridRow: '4 / span 1' }}
          />

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

        {/* Hero */}
        <BentoCard variant="forest" className="relative overflow-hidden" style={{ minHeight: 200 }}>
          {heroContent}
        </BentoCard>

        {/* Profile */}
        <ProfileTile />

        {/* Events */}
        <CalendarTile />

        {/* Trip */}
        {nextTrip && (
          <BentoCard variant="crimson" className="relative overflow-hidden p-0" style={{ minHeight: 180 }}>
            {tripContent}
          </BentoCard>
        )}

        {/* Announcement */}
        {featuredAnnouncement && (
          <BentoCard variant="default" className="flex flex-col">
            {announcementContent2}
          </BentoCard>
        )}

        {/* Links & Guides */}
        <LinksGuidesTile links={links} />

        {/* About */}
        <BentoCard variant="default" className="flex flex-col">
          {aboutContent}
        </BentoCard>

        {/* Map */}
        <LocationTile style={{ minHeight: 200 }} />

        {/* Theme + FontSize side by side */}
        <div className="grid grid-cols-2 gap-3">
          <ThemeTile />
          <FontSizeTile />
        </div>

        {/* Socials */}
        <SocialsTile />

      </div>

    </div>
  )
}
