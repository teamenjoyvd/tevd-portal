import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase/server'
import BentoGrid from '@/components/bento/BentoGrid'
import BentoCard from '@/components/bento/BentoCard'
import ProfileTile from './components/tiles/ProfileTile'
import CalendarTile from './components/tiles/CalendarTile'
import HeroTile from './components/tiles/HeroTile'
import AboutTile from './components/tiles/AboutTile'
import AnnouncementTile from './components/tiles/AnnouncementTile'
import TripHeroTile from './components/tiles/TripHeroTile'
import LinksGuidesTile from './components/tiles/LinksGuidesTile'
import LocationTileLazy from './components/tiles/LocationTileLazy'
import ThemeTile from './components/tiles/ThemeTile'
import FontSizeTile from './components/tiles/FontSizeTile'
import SocialsTileDesktop from './components/tiles/SocialsTileDesktop'
import SocialsTileMobile from './components/tiles/SocialsTileMobile'

export default async function HomePage() {
  const { userId } = await auth()
  const supabase = await createClient()

  // Calendar events
  const { data: events = [] } = await supabase
    .from('calendar_events')
    .select('id, title, start_time, end_time, event_type, category')
    .gte('end_time', new Date().toISOString())
    .order('start_time', { ascending: true })
    .limit(5)

  // Next trip
  const { data: nextTrip } = await supabase
    .from('trips')
    .select('id, title, start_date, end_date, image_url, location')
    .gte('end_date', new Date().toISOString().split('T')[0])
    .order('start_date', { ascending: true })
    .limit(1)
    .maybeSingle()

  // Featured announcement
  const { data: announcement } = await supabase
    .from('announcements')
    .select('titles, contents, slug')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle()

  const announcementTitle = announcement?.titles?.en ?? announcement?.titles?.bg ?? null
  const announcementContent = announcement?.contents?.en ?? announcement?.contents?.bg ?? null
  const announcementSlug = announcement?.slug ?? null

  // Quick links
  const { data: links = [] } = await supabase
    .from('quick_links')
    .select('id, labels, url, is_active')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(6)

  // Guides
  const { data: guides = [] } = await supabase
    .from('guides')
    .select('id, titles, slug, emoji')
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
    .limit(4)

  return (
    <div style={{ backgroundColor: 'var(--bg-global)' }}>

      {/* ── DESKTOP (md+) ──────────────────────────────────────────────────────────── */}
      <div className="hidden md:block">
        <BentoGrid
          className="py-4 pb-16"
          cols={12}
          gap={3}
        >
          {/* Row 1 */}
          <BentoCard variant="forest" colSpan={6} rowSpan={2} className="relative overflow-hidden p-0">
            <HeroTile />
          </BentoCard>
          <ProfileTile colSpan={3} rowSpan={2} />
          <CalendarTile events={events} colSpan={3} rowSpan={4} />

          {/* Row 2 — ProfileTile continues */}

          {/* Row 3 */}
          {nextTrip ? (
            <BentoCard variant="crimson" colSpan={3} rowSpan={2} className="relative overflow-hidden p-0">
              <TripHeroTile trip={nextTrip} />
            </BentoCard>
          ) : (
            <BentoCard variant="crimson" colSpan={3} rowSpan={2} />
          )}
          <SocialsTileDesktop colSpan={3} rowSpan={2} />

          {/* Row 4 — CalendarTile, TripHeroTile, SocialsTile continue */}

          {/* Row 5 */}
          {announcementTitle && (
            <BentoCard variant="default" colSpan={3} className="flex flex-col">
              <AnnouncementTile title={announcementTitle} content={announcementContent} slug={announcementSlug} />
            </BentoCard>
          )}
          <LinksGuidesTile links={links} guides={guides} colSpan={3} />
          <BentoCard variant="default" colSpan={3} className="flex flex-col">
            <AboutTile />
          </BentoCard>
          <LocationTileLazy colSpan={3} />

          {/* Row 6 */}
          <BentoCard variant="default" colSpan={9}>
            {/* placeholder */}
          </BentoCard>
          <div className="col-span-3 grid grid-cols-2 gap-3">
            <ThemeTile />
            <FontSizeTile />
          </div>

        </BentoGrid>
      </div>

      {/* ── MOBILE (< md) ──────────────────────────────────────────────────────────── */}
      <div className="md:hidden flex flex-col gap-3 px-4 py-4 pb-24">

        <BentoCard variant="forest" className="relative overflow-hidden" style={{ minHeight: 200 }}>
          <HeroTile />
        </BentoCard>

        <ProfileTile style={{ minHeight: 200 }} />

        <CalendarTile events={events} style={{ minHeight: 200 }} />

        {nextTrip && (
          <BentoCard variant="crimson" className="relative overflow-hidden p-0" style={{ minHeight: 200 }}>
            <TripHeroTile trip={nextTrip} />
          </BentoCard>
        )}

        {featuredAnnouncement && announcementTitle && (
          <BentoCard variant="default" className="flex flex-col" style={{ minHeight: 200 }}>
            <AnnouncementTile title={announcementTitle} content={announcementContent} slug={announcementSlug} />
          </BentoCard>
        )}

        <LinksGuidesTile links={links} guides={guides} style={{ minHeight: 200 }} />

        <BentoCard variant="default" className="flex flex-col" style={{ minHeight: 200 }}>
          <AboutTile />
        </BentoCard>

        <LocationTileLazy style={{ minHeight: 200 }} />

        <div className="grid grid-cols-2 gap-3" style={{ minHeight: 200 }}>
          <ThemeTile />
          <FontSizeTile />
        </div>

        <SocialsTileMobile />

      </div>
    </div>
  )
}
