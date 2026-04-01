import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { scrapeOgTags } from '@/lib/og-scrape'
import { requireAdmin } from '@/lib/supabase/guards'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const guard = await requireAdmin(userId, supabase)
  if (guard) return guard

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
  const guard = await requireAdmin(userId, supabase)
  if (guard) return guard

  const body: {
    platform?: string
    post_url?: string
    caption?: string
    thumbnail_url?: string
    items?: { id: string; sort_order: number }[]
  } = await req.json()

  // Batch reorder: { items: [{ id, sort_order }] }
  if (Array.isArray(body.items)) {
    const updates = await Promise.all(
      body.items.map((item: { id: string; sort_order: number }) =>
        supabase.from('social_posts').update({ sort_order: item.sort_order }).eq('id', item.id)
      )
    )
    const err = updates.find(r => r.error)
    if (err?.error) return Response.json({ error: err.error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

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
