import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('abo_number, upline_abo_number')
    .eq('clerk_id', userId)
    .single()

  // Determine which ABO to use for the los_members lookup.
  // Standard path: profile.abo_number exists → look up sponsor via los_members.
  // Manual path: abo_number is null but upline_abo_number was set at approval time
  //              → use it directly as the upline ABO, then resolve the name.
  const memberAbo = profile?.abo_number ?? null
  const directUplineAbo = profile?.upline_abo_number ?? null

  if (memberAbo) {
    // Standard path: resolve sponsor via los_members tree
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
      upline_abo_number: upline?.abo_number ?? null,
    })
  }

  if (directUplineAbo) {
    // Manual path: upline ABO is already known, just resolve the name
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
