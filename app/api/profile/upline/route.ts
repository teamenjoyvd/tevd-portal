import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('abo_number, upline_abo_number, primary_profile_id')
    .eq('clerk_id', userId)
    .single()

  // ADR-016: secondary profiles share ABO with their primary.
  // abo_number is written to both at approval time, so the standard
  // los_members lookup path works for secondaries without modification.
  // primary_profile_id is read here only for documentation clarity.

  const memberAbo = profile?.abo_number ?? null
  const directUplineAbo = profile?.upline_abo_number ?? null

  if (memberAbo) {
    const { data: losMember } = await supabase
      .from('los_members')
      .select('sponsor_abo_number')
      .eq('abo_number', memberAbo)
      .single()

    if (!losMember?.sponsor_abo_number) {
      return Response.json({ upline_name: null, upline_abo_number: null })
    }

    const { data: upline } = await supabase
      .from('los_members')
      .select('abo_number, name')
      .eq('abo_number', losMember.sponsor_abo_number)
      .single()

    return Response.json({
      upline_name: upline?.name ?? null,
      upline_abo_number: upline?.abo_number ?? losMember.sponsor_abo_number,
    })
  }

  if (directUplineAbo) {
    const { data: upline } = await supabase
      .from('los_members')
      .select('abo_number, name')
      .eq('abo_number', directUplineAbo)
      .single()

    return Response.json({
      upline_name: upline?.name ?? null,
      upline_abo_number: upline?.abo_number ?? directUplineAbo,
    })
  }

  return Response.json({ upline_name: null, upline_abo_number: null })
}
