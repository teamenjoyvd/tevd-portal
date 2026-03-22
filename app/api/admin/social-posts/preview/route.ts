import { auth } from '@clerk/nextjs/server'
import { scrapeOgTags } from '@/lib/og-scrape'

export async function GET(req: Request): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')
  if (!url) return Response.json({ error: 'Missing url param' }, { status: 400 })

  const result = await scrapeOgTags(url)
  return Response.json(result)
}
