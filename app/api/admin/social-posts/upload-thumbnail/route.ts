import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/supabase/guards'

const STORAGE_URL_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/social-thumbnails/`

/**
 * POST /api/admin/social-posts/upload-thumbnail
 *
 * Accepts a multipart form with a single `file` field.
 * Uploads to the social-thumbnails Storage bucket using the service role client.
 * Returns { url: string } — the permanent public URL.
 */
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const guard = await requireAdmin(userId, supabase)
  if (guard) return guard

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return Response.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return Response.json({ error: 'Missing file field' }, { status: 400 })
  }

  const contentType = file.type || 'image/jpeg'
  const ext = contentType.includes('png') ? 'png'
    : contentType.includes('webp') ? 'webp'
    : contentType.includes('gif') ? 'gif'
    : 'jpg'

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const buffer = await file.arrayBuffer()

  const { error } = await supabase.storage
    .from('social-thumbnails')
    .upload(filename, buffer, { contentType, upsert: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ url: `${STORAGE_URL_PREFIX}${filename}` })
}
