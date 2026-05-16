import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerContext } from '@/lib/supabase/guards'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  // Any authenticated member (not just admin) can upload their own proof.
  // getCallerContext with 'adminOrCore' would be too restrictive;
  // we just need a resolved profile id — so fetch manually with a role check
  // that excludes only guest (no profile) or unauthenticated.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('clerk_id', userId)
    .single()

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
