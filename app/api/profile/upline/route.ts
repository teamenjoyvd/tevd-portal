import { withProfile } from '@/lib/supabase/with-profile'

export async function GET() {
  const ctx = await withProfile<{ abo_number: string | null; upline_abo_number: string | null; primary_profile_id: string | null }>(
    'abo_number, upline_abo_number, primary_profile_id'
  )
  if (ctx.response) return ctx.response
  const { supabase, profile } = ctx

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
