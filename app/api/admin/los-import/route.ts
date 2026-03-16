import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_id', userId)
    .single()

  if (profile?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { rows } = await req.json()

  if (!Array.isArray(rows) || rows.length === 0) {
    return Response.json({ error: 'No rows provided' }, { status: 400 })
  }

  // ── Snapshot current state before import ───────────────────────────────
  const { data: snapshot } = await supabase
    .from('los_members')
    .select('abo_number, abo_level, bonus_percent')

  const prevMap = new Map<string, { abo_level: string | null; bonus_percent: number | null }>(
    (snapshot ?? []).map(m => [
      m.abo_number,
      { abo_level: m.abo_level ?? null, bonus_percent: m.bonus_percent ?? null },
    ])
  )

  // ── Run import RPC ─────────────────────────────────────────────────────
  const { data, error } = await supabase.rpc('import_los_members', { rows })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  // Rebuild LTree paths after import
  await supabase.rpc('rebuild_tree_paths')

  // ── Compute diff against incoming rows ─────────────────────────────────
  type NewMember      = { abo_number: string; name: string; abo_level: string }
  type LevelChange    = { abo_number: string; name: string; prev_level: string; new_level: string }
  type BonusChange    = { abo_number: string; name: string; prev_bonus: number; new_bonus: number }

  const new_members:   NewMember[]   = []
  const level_changes: LevelChange[] = []
  const bonus_changes: BonusChange[] = []

  for (const row of rows as Record<string, string>[]) {
    const aboNum  = row.abo_number ?? ''
    const name    = row.name ?? ''
    const newLevel = row.abo_level ?? ''
    const newBonus = parseFloat(row.bonus_percent ?? '0') || 0

    const prev = prevMap.get(aboNum)

    if (!prev) {
      // Brand-new member
      new_members.push({ abo_number: aboNum, name, abo_level: newLevel })
    } else {
      // Level change
      if (prev.abo_level !== null && prev.abo_level !== newLevel) {
        level_changes.push({
          abo_number: aboNum,
          name,
          prev_level: prev.abo_level,
          new_level:  newLevel,
        })
      }
      // Significant bonus/rank change (≥3% shift)
      const prevBonus = prev.bonus_percent ?? 0
      if (Math.abs(newBonus - prevBonus) >= 3) {
        bonus_changes.push({
          abo_number: aboNum,
          name,
          prev_bonus: prevBonus,
          new_bonus:  newBonus,
        })
      }
    }
  }

  const rpcResult = data as { inserted: number; errors: { abo_number: string; error: string }[] }

  return Response.json({
    inserted: rpcResult.inserted,
    errors:   rpcResult.errors,
    diff: { new_members, level_changes, bonus_changes },
  })
}