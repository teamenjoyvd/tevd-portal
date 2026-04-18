import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('clerk_id', userId)
    .single()

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
  }

  const { id: tripId } = await params

  // Admins bypass the registration gate
  if (profile.role !== 'admin') {
    const { data: reg, error: regErr } = await supabase
      .from('trip_registrations')
      .select('id')
      .eq('trip_id', tripId)
      .eq('profile_id', profile.id)
      .eq('status', 'approved')
      .maybeSingle()

    if (regErr || !reg) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Never select created_by — members must not see authorship
  const { data: messages, error: msgErr } = await supabase
    .from('trip_messages')
    .select('id, body, created_at')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false })

  if (msgErr) {
    return NextResponse.json({ error: msgErr.message }, { status: 500 })
  }

  return NextResponse.json(messages ?? [])
}
