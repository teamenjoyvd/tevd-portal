import { NextRequest, NextResponse } from 'next/server'
import { withProfile } from '@/lib/supabase/with-profile'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Any authenticated member (not just admin) can upload their own proof.
  // getCallerContext with 'adminOrCore' would be too restrictive;
  // we just need a resolved profile id — so fetch manually with a role check
  // that excludes only guest (no profile) or unauthenticated.
  const ctx = await withProfile()
  if (ctx.response) return ctx.response as NextResponse
  const { supabase, profile } = ctx

  if (!profile) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const filename = req.nextUrl.searchParams.get('filename') ?? 'upload'
  const parts = filename.split('.')
  const ext = parts.length > 1 ? parts.pop()! : 'bin'
  const path = `${profile.id}/${randomUUID()}.${ext}`

  const { data, error } = await supabase.storage
    .from('trip-proofs')
    .createSignedUploadUrl(path)

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create signed URL' }, { status: 500 })
  }

  return NextResponse.json({ signedUrl: data.signedUrl, path })
}
