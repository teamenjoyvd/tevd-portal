import { NextRequest, NextResponse } from 'next/server'
import { withProfile } from '@/lib/supabase/with-profile'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest): Promise<Response> {
  const ctx = await withProfile<{ id: string }>('id')
  if (ctx.response) return ctx.response
  const { profile } = ctx

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
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

  // Return the path directly — callers store this as proof_url.
  // The bucket is private; reading is done via /api/profile/payments/[paymentId]/proof.
  // Note: the response key remains "url" for backwards compatibility with existing callers.
  return NextResponse.json({ url: path })
}
