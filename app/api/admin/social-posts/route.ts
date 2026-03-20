import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { scrapeOG } from '@/lib/og-scrape'

export async function GET(): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_id', userId)
    .single()

  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('social_posts')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ posts: data })
}

export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_id', userId)
    .single()

  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await req.json()) as {
    platform: string
    post_url: string
    caption?: string
    thumbnail_url?: string
  }

  let caption = body.caption
  let thumbnail_url = body.thumbnail_url

  if (!thumbnail_url || !caption) {
    const scraped = await scrapeOG(body.post_url)
    if (!thumbnail_url) thumbnail_url = scraped.thumbnail_url ?? undefined
    if (!caption) caption = scraped.caption ?? undefined
  }

  const { data, error } = await supabase
    .from('social_posts')
    .insert({
      platform: body.platform,
      post_url: body.post_url,
      caption: caption ?? null,
      thumbnail_url: thumbnail_url ?? null,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ post: data }, { status: 201 })
}
