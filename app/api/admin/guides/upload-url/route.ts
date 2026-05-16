import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_id', userId)
    .single()
  if (caller?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const filename = req.nextUrl.searchParams.get('filename') ?? 'upload'
  const parts = filename.split('.')
  const ext = parts.length > 1 ? parts.pop()! : 'bin'
  const path = `body/${randomUUID()}.${ext}`

  const { data, error } = await supabase.storage
    .from('guide-images')
    .createSignedUploadUrl(path)

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create signed URL' }, { status: 500 })
  }

  return NextResponse.json({ signedUrl: data.signedUrl, path })
}
