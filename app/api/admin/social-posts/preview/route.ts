import { auth } from '@clerk/nextjs/server'
import { scrapeOgTags } from '@/lib/og-scrape'
import { createServiceClient } from '@/lib/supabase/service'
import { mirrorToStorage, isCdnUrl } from '@/lib/social-thumbnail'

export async function GET(req: Request): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')
  if (!url) return Response.json({ error: 'Missing url param' }, { status: 400 })

  const result = await scrapeOgTags(url)

  // Mirror CDN thumbnail to Storage so the admin form field is pre-populated
  // with a permanent URL rather than an ephemeral signed CDN URL.
  if (result.thumbnail_url && isCdnUrl(result.thumbnail_url)) {
    const supabase = createServiceClient()
    const mirrored = await mirrorToStorage(result.thumbnail_url, supabase)
    if (mirrored) result.thumbnail_url = mirrored
  }

  return Response.json(result)
}
