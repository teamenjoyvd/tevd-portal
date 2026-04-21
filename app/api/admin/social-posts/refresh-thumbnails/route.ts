import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/supabase/guards'
import { mirrorToStorage } from '@/lib/social-thumbnail'

const STORAGE_URL_FRAGMENT = '/storage/v1/object/public/social-thumbnails/'
const CONCURRENCY = 5

/**
 * POST /api/admin/social-posts/refresh-thumbnails
 *
 * One-shot backfill: iterates all social_posts with a non-Storage thumbnail_url
 * and re-mirrors them to the social-thumbnails bucket.
 * Admin-only. Idempotent — safe to call multiple times.
 */
export async function POST() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const guard = await requireAdmin(userId, supabase)
  if (guard) return guard

  // Filter at the DB level — only fetch rows that are not already in Storage.
  const { data: posts, error } = await supabase
    .from('social_posts')
    .select('id, thumbnail_url')
    .not('thumbnail_url', 'is', null)
    .not('thumbnail_url', 'ilike', `%${STORAGE_URL_FRAGMENT}%`)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const results = { updated: 0, skipped: 0, failed: 0 }

  // Process in parallel with a fixed concurrency cap to avoid serverless timeouts.
  const queue = [...(posts ?? [])]

  async function processChunk() {
    while (queue.length > 0) {
      const post = queue.shift()!
      const url = post.thumbnail_url
      if (!url) { results.skipped++; continue }

      const mirrored = await mirrorToStorage(url, supabase)
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
