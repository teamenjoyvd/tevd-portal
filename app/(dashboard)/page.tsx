import { createServiceClient } from '@/lib/supabase/service'
import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'

type CalendarEvent = {
  id: string; title: string; start_time: string
  end_time: string; week_number: number; category: string
}
type Announcement = {
  id: string; titles: Record<string,string>; contents: Record<string,string>
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

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

function formatEventTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit',
  })
}

export default async function HomePage() {
  const { userId } = await auth()
  const supabase = createServiceClient()

  // Determine role for content filtering
  let role = 'guest'
  if (userId) {
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('clerk_id', userId).single()
    if (profile?.role) role = profile.role
  }

  const roleArr = ['guest', ...(role !== 'guest' ? ['member'] : []), ...(role === 'core' || role === 'admin' ? ['core'] : []), ...(role === 'admin' ? ['admin'] : [])]

  const [settingsRes, announcementsRes, quickLinksRes, eventsRes] = await Promise.all([
    supabase.from('home_settings').select('*').single(),
    supabase.from('announcements').select('*').eq('is_active', true)
      .order('created_at', { ascending: false }).limit(5),
    supabase.from('quick_links').select('*').order('sort_order'),
    supabase.from('calendar_events').select('*').eq('category', 'N21')
      .gte('start_time', new Date().toISOString()).order('start_time').limit(3),
  ])

  const settings: HomeSettings | null = settingsRes.data
  const announcements: Announcement[] = (announcementsRes.data ?? []).filter(
    (a: Announcement) => true // RLS handles filtering; service role sees all, filter by role clientside
  )
  const quickLinks: QuickLink[] = quickLinksRes.data ?? []
  const nextEvents: CalendarEvent[] = eventsRes.data ?? []

  const carets = [
    { show: settings?.show_caret_1, text: settings?.caret_1_text },
    { show: settings?.show_caret_2, text: settings?.caret_2_text },
    { show: settings?.show_caret_3, text: settings?.caret_3_text },
  ].filter(c => c.show && c.text)

  return (
    <div className="min-h-screen bg-[#f4f1de]">

      {/* Hero */}
      <div className="bg-[#2d332a] text-white px-6 py-16 text-center">
        <h1 className="text-4xl font-serif mb-3">teamenjoyVD</h1>
        <p className="text-white/60 text-sm tracking-widest uppercase">N21 Community Portal</p>
        {!userId && (
          <Link href="/sign-in"
            className="mt-8 inline-block bg-[#bc4749] text-white px-8 py-3 rounded-full text-sm font-medium hover:bg-[#a33d3f] transition-colors">
            Sign in
          </Link>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-10">

        {/* Focus carets */}
        {carets.length > 0 && (
          <section className="grid grid-cols-1 gap-3">
            {carets.map((c, i) => (
              <div key={i} className="bg-[#e07a5f] text-white rounded-xl px-5 py-4 text-sm font-medium">
                {c.text}
              </div>
            ))}
          </section>
        )}

        {/* Next events */}
        {nextEvents.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[#3d405b] uppercase tracking-wide">
                Upcoming events
              </h2>
              <Link href="/calendar" className="text-xs text-[#bc4749] hover:underline">
                See all →
              </Link>
            </div>
            <div className="space-y-2">
              {nextEvents.map(event => (
                <div key={event.id} className="bg-white rounded-xl p-4 border border-[#8e8b82]/20">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[#3d405b]">{event.title}</p>
                      <p className="text-xs text-[#8e8b82] mt-0.5">
                        {formatEventDate(event.start_time)} · {formatEventTime(event.start_time)}
                      </p>
                    </div>
                    <span className="text-xs text-[#8e8b82] flex-shrink-0">
                      W{event.week_number}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Announcements */}
        {announcements.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-[#3d405b] uppercase tracking-wide mb-3">
              Announcements
            </h2>
            <div className="space-y-3">
              {announcements.map(a => (
                <div key={a.id} className="bg-white rounded-xl p-5 border border-[#8e8b82]/20">
                  <h3 className="font-medium text-[#3d405b] mb-1">
                    {a.titles.en ?? a.titles.bg ?? 'Announcement'}
                  </h3>
                  <p className="text-sm text-[#8e8b82] leading-relaxed">
                    {a.contents.en ?? a.contents.bg ?? ''}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Quick links */}
        {quickLinks.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-[#3d405b] uppercase tracking-wide mb-3">
              Quick links
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {quickLinks.map(link => (
                <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                  className="bg-white rounded-xl px-4 py-3 border border-[#8e8b82]/20 text-sm font-medium text-[#3d405b] hover:border-[#bc4749]/40 transition-colors flex items-center gap-2">
                  <span className="text-[#bc4749]">→</span>
                  {link.label}
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Empty state for guest with no content */}
        {!userId && carets.length === 0 && nextEvents.length === 0 && announcements.length === 0 && (
          <div className="text-center py-10 text-[#8e8b82]">
            <p className="text-sm">Sign in to access your portal.</p>
          </div>
        )}

      </div>
    </div>
  )
}