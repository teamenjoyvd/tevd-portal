import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_id', userId)
    .single()
  if (caller?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as { path?: string }
  const { path } = body

  if (!path || typeof path !== 'string') {
    return NextResponse.json({ error: 'path is required' }, { status: 400 })
  }

  // Path ownership check — only covers/ prefix is valid for cover images
  if (!path.startsWith('covers/')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  const { data } = supabase.storage.from('guide-covers').getPublicUrl(path)

  return NextResponse.json({ url: data.publicUrl })
}
