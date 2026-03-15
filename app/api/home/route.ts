import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const supabase = createServiceClient()

  const [settings, announcements, quickLinks, events] = await Promise.all([
    supabase.from('home_settings')
      .select('*, featured_announcement:announcements(*)')
      .single(),
    supabase.from('announcements')
      .select('*')
      .eq('is_active', true)
      .contains('access_level', ['guest'])
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('quick_links')
      .select('*')
      .contains('access_level', ['guest'])
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