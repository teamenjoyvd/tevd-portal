import { createServiceClient } from '@/lib/supabase/service'
import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import PageContainer from '@/components/layout/PageContainer'

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
  let userId: string | null = null
  try {
    const session = await auth()
    userId = session.userId
  } catch {
    userId = null
  }

  const supabase = createServiceClient()
  const [settingsRes, announcementsRes, quickLinksRes, eventsRes] = await Promise.all([
    supabase.from('home_settings').select('*').single(),
    supabase.from('announcements').select('*').eq('is_active', true)
      .order('created_at', { ascending: false }).limit(5),
    supabase.from('quick_links').select('*').order('sort_order'),
    supabase.from('calendar_events').select('*').eq('category', 'N21')
      .gte('start_time', new Date().toISOString()).order('start_time').limit(3),
  ])

  const settings      = settingsRes.data as HomeSettings | null
  const announcements = (announcementsRes.data ?? []) as unknown as Announcement[]
  const quickLinks    = (quickLinksRes.data ?? []) as unknown as QuickLink[]
  const nextEvents    = (eventsRes.data ?? []) as unknown as CalendarEvent[]

  const carets = [
    { show: settings?.show_caret_1, text: settings?.caret_1_text },
    { show: settings?.show_caret_2, text: settings?.caret_2_text },
    { show: settings?.show_caret_3, text: settings?.caret_3_text },
  ].filter(c => c.show && c.text)

  return (
    <div style={{ backgroundColor: 'white' }}>

      {/* Hero — full bleed, no container */}
      <div
        className="relative overflow-hidden px-6 py-20 text-center"
        style={{ backgroundColor: 'var(--forest)' }}
      >
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, #e07a5f 0%, transparent 50%), radial-gradient(circle at 80% 20%, #81b29a 0%, transparent 40%)',
        }} />
        <div className="relative">
          <p className="text-xs tracking-[0.3em] uppercase mb-3"
            style={{ color: 'var(--sienna)' }}>
            N21 Community
          </p>
          <h1 className="text-5xl md:text-6xl font-serif font-bold text-white mb-3">
            teamenjoyVD
          </h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Members Portal
          </p>
          {!userId && (
            <Link
              href="/sign-in"
              className="mt-8 inline-flex items-center gap-2 px-8 py-3 rounded-full text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ backgroundColor: 'var(--crimson)' }}
            >
              Sign in to your account
            </Link>
          )}
        </div>
      </div>

      {/* Content — in 1024px container */}
      <PageContainer>
        <div className="max-w-2xl py-10 space-y-10">

          {carets.length > 0 && (
            <section className="space-y-2">
              {carets.map((c, i) => (
                <div
                  key={i}
                  className="rounded-2xl px-5 py-4 text-sm font-medium text-white"
                  style={{ backgroundColor: 'var(--sienna)' }}
                >
                  {c.text}
                </div>
              ))}
            </section>
          )}

          {nextEvents.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold tracking-widest uppercase"
                  style={{ color: 'var(--stone)' }}>
                  Upcoming events
                </p>
                <Link href="/calendar" className="text-xs font-medium hover:underline"
                  style={{ color: 'var(--crimson)' }}>
                  See all →
                </Link>
              </div>
              <div className="bg-white rounded-2xl border border-black/5 shadow-sm divide-y divide-black/5 overflow-hidden">
                {nextEvents.map(event => (
                  <div key={event.id} className="px-5 py-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--deep)' }}>
                        {event.title}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--stone)' }}>
                        {formatEventDate(event.start_time)} · {formatEventTime(event.start_time)}
                      </p>
                    </div>
                    <span
                      className="text-xs font-semibold px-2 py-1 rounded-lg flex-shrink-0"
                      style={{ backgroundColor: 'var(--forest)', color: 'rgba(255,255,255,0.7)' }}
                    >
                      W{event.week_number}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {announcements.length > 0 && (
            <section>
              <p className="text-xs font-semibold tracking-widest uppercase mb-3"
                style={{ color: 'var(--stone)' }}>
                Announcements
              </p>
              <div className="space-y-3">
                {announcements.map(a => (
                  <div key={a.id}
                    className="bg-white rounded-2xl border border-black/5 shadow-sm px-5 py-4">
                    <h3 className="font-serif text-base font-semibold mb-1"
                      style={{ color: 'var(--deep)' }}>
                      {a.titles?.en ?? a.titles?.bg ?? 'Announcement'}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--stone)' }}>
                      {a.contents?.en ?? a.contents?.bg ?? ''}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {quickLinks.length > 0 && (
            <section>
              <p className="text-xs font-semibold tracking-widest uppercase mb-3"
                style={{ color: 'var(--stone)' }}>
                Quick links
              </p>
              <div className="grid grid-cols-2 gap-2">
                {quickLinks.map(link => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white rounded-2xl border border-black/5 shadow-sm px-4 py-3.5 text-sm font-medium flex items-center gap-2 hover:shadow-md transition-shadow"
                    style={{ color: 'var(--deep)' }}
                  >
                    <span style={{ color: 'var(--crimson)' }}>→</span>
                    {link.label}
                  </a>
                ))}
              </div>
            </section>
          )}

          {!userId && carets.length === 0 && nextEvents.length === 0 && announcements.length === 0 && (
            <div className="text-center py-16">
              <p className="text-sm" style={{ color: 'var(--stone)' }}>
                Sign in to access your portal.
              </p>
            </div>
          )}

        </div>
      </PageContainer>
    </div>
  )
}