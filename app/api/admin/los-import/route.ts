import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/supabase/guards'

// ── GET — current LOS state ───────────────────────────────────────────────────

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const guard = await requireAdmin(userId, supabase)
  if (guard) return guard

  const { count } = await supabase
    .from('los_members')
    .select('*', { count: 'exact', head: true })

  const { data: lastImport } = await supabase
    .from('los_imports')
    .select('id, imported_at, row_count, removed_count, status')
    .order('imported_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: lastMember } = await supabase
    .from('los_members')
    .select('last_synced_at')
    .order('last_synced_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return Response.json({
    row_count: count ?? 0,
    last_synced_at: lastMember?.last_synced_at ?? null,
    last_import_id: lastImport?.id ?? null,
    last_import: lastImport ?? null,
  })
}

// ── POST — run import ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const guard = await requireAdmin(userId, supabase)
  if (guard) return guard

  const { rows, expected_row_count, imported_by_profile_id } = await req.json()

  if (!Array.isArray(rows) || rows.length === 0) {
    return Response.json({ error: 'No rows provided' }, { status: 400 })
  }

  // ── Snapshot current state for diff (before RPC runs) ────────────────────
  const { data: snapshot } = await supabase
    .from('los_members')
    .select('abo_number, abo_level, bonus_percent')

  const prevMap = new Map<string, { abo_level: string | null; bonus_percent: number | null }>(
    (snapshot ?? []).map(m => [
      m.abo_number,
      { abo_level: m.abo_level ?? null, bonus_percent: m.bonus_percent ?? null },
    ])
  )

  const prevAbos = new Set((snapshot ?? []).map(m => m.abo_number as string))
  const incomingAbos = new Set((rows as Record<string, string>[]).map(r => r.abo_number))

  // ── Call transactional RPC ────────────────────────────────────────────────
  const { data, error } = await supabase.rpc('import_los_members', {
    p_rows: rows,
    p_imported_by: imported_by_profile_id ?? null,
    p_expected_row_count: expected_row_count ?? null,
  })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  // ── Compute diff ──────────────────────────────────────────────────────────
  type NewMember   = { abo_number: string; name: string; abo_level: string }
  type LevelChange = { abo_number: string; name: string; prev_level: string; new_level: string }
  type BonusChange = { abo_number: string; name: string; prev_bonus: number; new_bonus: number }
  type RemovedMember = { abo_number: string; name: string }

  const new_members:    NewMember[]    = []
  const level_changes:  LevelChange[]  = []
  const bonus_changes:  BonusChange[]  = []
  const removed_members: RemovedMember[] = []

  for (const row of rows as Record<string, string>[]) {
    const aboNum   = row.abo_number ?? ''
    const name     = row.name ?? ''
    const newLevel = row.abo_level ?? ''
    const newBonus = parseFloat(row.bonus_percent ?? '0') || 0
    const prev     = prevMap.get(aboNum)

    if (!prev) {
      new_members.push({ abo_number: aboNum, name, abo_level: newLevel })
    } else {
      if (prev.abo_level !== null && prev.abo_level !== newLevel) {
        level_changes.push({ abo_number: aboNum, name, prev_level: prev.abo_level, new_level: newLevel })
      }
      const prevBonus = prev.bonus_percent ?? 0
      if (Math.abs(newBonus - prevBonus) >= 3) {
        bonus_changes.push({ abo_number: aboNum, name, prev_bonus: prevBonus, new_bonus: newBonus })
      }
    }
  }

  // Removed: was in DB before, not in incoming set
  for (const abo of prevAbos) {
    if (!incomingAbos.has(abo)) {
      const prev = prevMap.get(abo)
      removed_members.push({ abo_number: abo, name: '' }) // name not in snapshot, acceptable
      void prev // suppress unused warning
    }
  }

  // ── Reconciliation data ───────────────────────────────────────────────────
  const { data: profileAbos } = await supabase
    .from('profiles')
    .select('abo_number')
    .not('abo_number', 'is', null)

  const profileAboSet = new Set((profileAbos ?? []).map(p => p.abo_number as string))

  const unrecognized = (rows as Record<string, string>[])
    .filter(r => r.abo_number && !profileAboSet.has(r.abo_number))
    .map(r => ({
      abo_number: r.abo_number,
      name: r.name ?? '',
      sponsor_abo_number: r.sponsor_abo_number ?? null,
    }))

  const { data: manualMembersNoAbo } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, upline_abo_number')
    .eq('role', 'member')
    .is('abo_number', null)

  const rpcResult = data as { inserted: number; removed: number; import_id: string; errors: { abo_number: string; error: string }[] }

  return Response.json({
    inserted: rpcResult.inserted,
    removed: rpcResult.removed,
    import_id: rpcResult.import_id,
    errors: rpcResult.errors,
    diff: { new_members, level_changes, bonus_changes, removed_members },
    unrecognized,
    manual_members_no_abo: manualMembersNoAbo ?? [],
  })
}
