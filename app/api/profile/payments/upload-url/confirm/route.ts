import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_id', userId)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json() as { path?: string }
  const { path } = body

  if (!path || typeof path !== 'string') {
    return NextResponse.json({ error: 'path is required' }, { status: 400 })
  }

  // Traversal guard
  if (path.includes('..')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  // Ownership check — path must be scoped to caller's own profile id
  if (!path.startsWith(`${profile.id}/`)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  const { data } = supabase.storage.from('trip-proofs').getPublicUrl(path)

  return NextResponse.json({ url: data.publicUrl })
}
