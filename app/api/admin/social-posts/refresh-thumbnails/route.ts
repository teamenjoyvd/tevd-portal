import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/supabase/guards'
import { mirrorToStorage, isStorageUrl } from '@/lib/social-thumbnail'

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

  const { data: posts, error } = await supabase
    .from('social_posts')
    .select('id, thumbnail_url')
    .not('thumbnail_url', 'is', null)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const results = { updated: 0, skipped: 0, failed: 0 }

  for (const post of posts ?? []) {
    const url = post.thumbnail_url
    if (!url || isStorageUrl(url)) { results.skipped++; continue }

    const mirrored = await mirrorToStorage(url, supabase)
    if (!mirrored) { results.failed++; continue }

    const { error: updateError } = await supabase
      .from('social_posts')
      .update({ thumbnail_url: mirrored })
      .eq('id', post.id)

    if (updateError) { results.failed++; continue }
    results.updated++
  }

  return Response.json(results)
}
