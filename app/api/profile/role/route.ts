import { withProfile } from '@/lib/supabase/with-profile'
import { NextResponse } from 'next/server'

export async function GET(): Promise<Response> {
  const ctx = await withProfile<{ role: string }>('role')
  if (ctx.response) return ctx.response
  const { profile, error } = ctx

  if (error || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  return NextResponse.json({ role: profile.role })
}
