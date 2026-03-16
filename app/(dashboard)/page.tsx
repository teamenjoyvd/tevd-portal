import { createServiceClient } from '@/lib/supabase/service'
import { auth } from '@clerk/nextjs/server'
import BentoGrid from '@/components/home/BentoGrid'
import PageContainer from '@/components/layout/PageContainer'

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

  // Resolve featured announcement
  const featuredAnnouncement: Announcement | null =
    settings?.featured_announcement_id
      ? (announcements.find(a => a.id === settings.featured_announcement_id) ?? announcements[0] ?? null)
      : (announcements[0] ?? null)

  return (
    <div style={{ backgroundColor: 'var(--eggshell)' }}>
      <PageContainer>
        <div className="py-4 pb-16">
          <BentoGrid
            announcement={featuredAnnouncement}
            quickLinks={quickLinks as unknown as { id: string; label: string; url: string; icon_name: string }[]}
            nextEvents={nextEvents}
            trips={trips}
            isAuthenticated={!!userId}
          />
        </div>
      </PageContainer>
    </div>
  )
}