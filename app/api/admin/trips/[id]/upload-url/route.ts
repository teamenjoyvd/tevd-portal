import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_id', userId)
    .single()

  if (profile?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const filename = url.searchParams.get('filename') ?? 'file'
  const ext = filename.split('.').pop() ?? 'bin'
  const path = `${tripId}/${crypto.randomUUID()}.${ext}`

  // Signed upload URLs have a fixed 2-hour expiry in the Supabase JS SDK —
  // expiresIn is not a supported option on createSignedUploadUrl ({ upsert } only).
  // 2 hours is sufficient for any realistic file size under the 50 MB free tier ceiling.
  const { data, error } = await supabase.storage
    .from('trip-attachments')
    .createSignedUploadUrl(path)

  if (error || !data) {
    return Response.json({ error: error?.message ?? 'Failed to create signed URL' }, { status: 500 })
  }

  return Response.json({ signedUrl: data.signedUrl, path })
}
