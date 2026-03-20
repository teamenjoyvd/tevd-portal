import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { scrapeOgTags } from '@/lib/og-scrape'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('clerk_id', userId).single()
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('social_posts')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('clerk_id', userId).single()
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body: {
    platform: string
    post_url: string
    caption?: string
    thumbnail_url?: string
  } = await req.json()

  if (!body.platform || !body.post_url) {
    return Response.json({ error: 'platform and post_url are required' }, { status: 400 })
  }

  let thumbnail_url = body.thumbnail_url ?? null
  let caption = body.caption ?? null

  if (!thumbnail_url || !caption) {
    const scraped = await scrapeOgTags(body.post_url)
    if (!thumbnail_url) thumbnail_url = scraped.thumbnail_url
    if (!caption) caption = scraped.caption
  }

  const { data, error } = await supabase
    .from('social_posts')
    .insert({
      platform: body.platform,
      post_url: body.post_url,
      caption,
      thumbnail_url,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
