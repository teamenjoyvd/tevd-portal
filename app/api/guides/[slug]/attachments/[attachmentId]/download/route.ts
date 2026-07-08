import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getRoleForAccess } from '@/lib/server/guides'

export const dynamic = 'force-dynamic'

const SIGNED_URL_TTL_SECONDS = 60

// Signed-URL read endpoint for guide-attachments, gated by the same
// is_published + access_roles check used for the guide itself
// (see app/(dashboard)/library/[slug]/page.tsx and
// guides.howtos_select_published RLS policy). guide-attachments is a
// private bucket (see supabase/migrations, issue #480) — public URLs
// stored on guide_attachments.file_url no longer resolve; this route
// is the only supported read path.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; attachmentId: string }> }
): Promise<NextResponse> {
  // NOTE: despite the `slug` param name (required to match the sibling
  // app/api/guides/[slug]/route.ts segment — Next.js requires the same
  // dynamic-segment name at a given route position across the whole app),
  // this value is the guide's UUID, not its slug. See guides.id query below.
  const { slug: guideId, attachmentId } = await params
  const supabase = createServiceClient()

  const role = await getRoleForAccess()

  const [guideRes, attachmentRes] = await Promise.all([
    supabase
      .from('guides')
      .select('id, is_published, access_roles')
      .eq('id', guideId)
      .eq('is_published', true)
      .single(),
    supabase
      .from('guide_attachments')
      .select('id, file_url, file_name')
      .eq('id', attachmentId)
      .eq('guide_id', guideId)
      .single(),
  ])

  const guide = guideRes.data
  const attachment = attachmentRes.data

  if (!guide) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const accessRoles = (guide.access_roles as string[] | null) ?? []
  if (!accessRoles.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!attachment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let storagePath: string | undefined
  try {
    storagePath = decodeURIComponent(
      new URL(attachment.file_url).pathname.split('/guide-attachments/')[1] ?? ''
    )
  } catch {
    storagePath = undefined
  }

  if (!storagePath) {
    return NextResponse.json({ error: 'Invalid attachment' }, { status: 500 })
  }

  const { data: signed, error } = await supabase.storage
    .from('guide-attachments')
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS, { download: attachment.file_name })

  if (error || !signed) {
    return NextResponse.json({ error: error?.message ?? 'Failed to sign URL' }, { status: 500 })
  }

  return NextResponse.redirect(signed.signedUrl)
}
