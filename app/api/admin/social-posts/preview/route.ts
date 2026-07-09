import { auth } from '@clerk/nextjs/server'
import { scrapeOgTags } from '@/lib/og-scrape'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/supabase/guards'
import { mirrorToStorage, isCdnUrl } from '@/lib/social-thumbnail'

export async function GET(req: Request): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const guard = await requireAdmin(userId, supabase)
  if (guard) return guard

  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')
  if (!url) return Response.json({ error: 'Missing url param' }, { status: 400 })

  const result = await scrapeOgTags(url)

  // Mirror CDN thumbnail to Storage so the admin form field is pre-populated
  // with a permanent URL rather than an ephemeral signed CDN URL.
  if (result.thumbnail_url && isCdnUrl(result.thumbnail_url)) {
    const mirrored = await mirrorToStorage(result.thumbnail_url, supabase)
    if (mirrored) result.thumbnail_url = mirrored
  }

  return Response.json(result)
}
