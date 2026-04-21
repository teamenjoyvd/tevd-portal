import { auth } from '@clerk/nextjs/server'
 import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/supabase/guards'
import { mirrorToStorage } from '@/lib/social-thumbnail'

const STORAGE_URL_FRAGMENT = '/storage/v1/object/public/social-thumbnails/'
const CONCURRENCY = 5
// Default cap per run — prevents serverless timeouts on large datasets.
// Callers can override via ?limit=N. social_posts is admin-curated and
// expected to stay small; this is a safety valve, not a routine concern.
const DEFAULT_LIMIT = 200

/**
 * POST /api/admin/social-posts/refresh-thumbnails
 *
 * One-shot backfill: iterates social_posts with a non-Storage thumbnail_url
 * and re-mirrors them to the social-thumbnails bucket.
 * Admin-only. Idempotent — safe to call multiple times.
 *
 * Query params:
 *   limit (optional, default 200) — max rows to process per call.
 *
 * Note: the .not('ilike') filter requires a full table scan — acceptable
 * for social_posts which is admin-curated and bounded in size.
 */
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const guard = await requireAdmin(userId, supabase)
  if (guard) return guard

  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 500)

  // Filter at the DB level — only fetch rows that are not already in Storage.
  const { data: posts, error } = await supabase
    .from('social_posts')
    .select('id, thumbnail_url')
    .not('thumbnail_url', 'is', null)
    .not('thumbnail_url', 'ilike', `%${STORAGE_URL_FRAGMENT}%`)
    .limit(limit)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const results = { updated: 0, skipped: 0, failed: 0, limit }

  // Process in parallel with a fixed concurrency cap.
  const queue = [...(posts ?? [])]

  async function processChunk() {
    while (queue.length > 0) {
      const post = queue.shift()!
      const postUrl = post.thumbnail_url
      if (!postUrl) { results.skipped++; continue }

      const mirrored = await mirrorToStorage(postUrl, supabase)
      if (!mirrored) { results.failed++; continue }

      const { error: updateError } = await supabase
        .from('social_posts')
        .update({ thumbnail_url: mirrored })
        .eq('id', post.id)

      if (updateError) { results.failed++; continue }
      results.updated++
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, processChunk))

  return Response.json(results)
}
