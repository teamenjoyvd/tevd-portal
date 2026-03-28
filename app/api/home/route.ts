import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const supabase = createServiceClient()

  // Resolve caller role so announcements and quick_links respect access_level.
  // Unauthenticated callers (public homepage) fall back to 'guest'.
  let role = 'guest'
  try {
    const { userId } = await auth()
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('clerk_id', userId).single()
      if (profile?.role) role = profile.role
    }
  } catch { /* unauthenticated */ }

  const [settings, announcements, quickLinks, events] = await Promise.all([
    supabase.from('home_settings')
      .select('*, featured_announcement:announcements(*)')
      .single(),
    supabase.from('announcements')
      .select('*')
      .eq('is_active', true)
      .contains('access_level', [role])
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('quick_links')
      .select('*')
      .contains('access_level', [role])
      .order('sort_order'),
    supabase.from('calendar_events')
      .select('*')
      .eq('category', 'N21')
      .gte('start_time', new Date().toISOString())
      .order('start_time')
      .limit(3),
  ])

  return Response.json({
    settings: settings.data,
    announcements: announcements.data ?? [],
    quickLinks: quickLinks.data ?? [],
    nextEvents: events.data ?? [],
  })
}
