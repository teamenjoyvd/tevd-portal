import { withProfile } from '@/lib/supabase/with-profile'
import { resolveUpline } from '@/lib/server/upline'

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

  const result = await resolveUpline(supabase, memberAbo, directUplineAbo, {
    fallbackStandardToSponsorAbo: true,
  })
  return Response.json(result)
}
