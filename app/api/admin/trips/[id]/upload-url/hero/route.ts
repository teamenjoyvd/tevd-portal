import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerContext } from '@/lib/supabase/guards'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const ctx = await getCallerContext(userId, supabase, 'admin')
  if (ctx.guard) return ctx.guard

  const url = new URL(req.url)
  const filename = url.searchParams.get('filename') ?? 'hero'
  const ext = filename.split('.').pop() ?? 'jpg'
  const path = `${tripId}/${crypto.randomUUID()}.${ext}`

  const { data, error } = await supabase.storage
    .from('trip-hero-images')
    .createSignedUploadUrl(path)

  if (error || !data) {
    return Response.json({ error: error?.message ?? 'Failed to create signed URL' }, { status: 500 })
  }

  return Response.json({ signedUrl: data.signedUrl, path })
}
