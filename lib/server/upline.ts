import type { SupabaseClient } from '@supabase/supabase-js'

export interface UplineResult {
  upline_name: string | null
  upline_abo_number: string | null
}

export interface ResolveUplineOptions {
  /**
   * Standard path only: when the sponsor ABO has no matching los_members row,
   * upline_abo_number falls back to the known sponsor ABO instead of null.
   * app/api/profile/upline/route.ts does this; app/api/profile/route.ts does
   * not (falls back to null) — a pre-existing divergence between the two
   * routes, preserved here rather than silently unified.
   */
  fallbackStandardToSponsorAbo?: boolean
}

/**
 * Standard path (abo_number set): resolve sponsor via the los_members tree,
 * then the sponsor's display name. Manual path (upline_abo_number set,
 * no abo_number): resolve the upline's name directly. Shared by
 * app/api/profile/upline/route.ts and app/api/profile/route.ts, whose
 * branching was previously duplicated verbatim.
 */
export async function resolveUpline(
  supabase: SupabaseClient,
  aboNumber: string | null,
  uplineAboNumber: string | null,
  options: ResolveUplineOptions = {}
): Promise<UplineResult> {
  if (aboNumber) {
    const { data: losMember } = await supabase
      .from('los_members')
      .select('sponsor_abo_number')
      .eq('abo_number', aboNumber)
      .single()

    if (!losMember?.sponsor_abo_number) {
      return { upline_name: null, upline_abo_number: null }
    }

    const { data: upline } = await supabase
      .from('los_members')
      .select('abo_number, name')
      .eq('abo_number', losMember.sponsor_abo_number)
      .single()

    return {
      upline_name: upline?.name ?? null,
      upline_abo_number:
        upline?.abo_number ?? (options.fallbackStandardToSponsorAbo ? losMember.sponsor_abo_number : null),
    }
  }

  if (uplineAboNumber) {
    const { data: upline } = await supabase
      .from('los_members')
      .select('abo_number, name')
      .eq('abo_number', uplineAboNumber)
      .single()

    return {
      upline_name: upline?.name ?? null,
      upline_abo_number: upline?.abo_number ?? uplineAboNumber,
    }
  }

  return { upline_name: null, upline_abo_number: null }
}
