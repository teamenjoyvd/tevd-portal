import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

type LOSRow = {
  abo_number: string
  sponsor_abo_number: string | null
  abo_level: string | null
  name: string | null
  country: string | null
  gpv: number | null
  ppv: number | null
  bonus_percent: number | null
  group_size: number | null
  qualified_legs: number | null
  annual_ppv: number | null
  renewal_date: string | null
  last_synced_at: string | null
  profile_id: string | null
  first_name: string | null
  last_name: string | null
  role: string | null
  depth: number | null
}

type VitalSign = {
  definition_id: string
  label: string
  recorded_at: string | null
  note: string | null
}

type LOSNodeWithVitals = LOSRow & { vital_signs: VitalSign[] }

// Synthetic node shape for users not in los_members (no ABO, or not yet imported)
type SyntheticNode = {
  profile_id: string
  abo_number: string | null
  sponsor_abo_number: null
  abo_level: null
  name: string
  first_name: string | null
  last_name: string | null
  role: string
  depth: null
  country: null
  gpv: null
  ppv: null
  bonus_percent: null
  group_size: null
  qualified_legs: null
  annual_ppv: null
  renewal_date: null
  last_synced_at: null
  vital_signs: VitalSign[]
}

type TreeNode = LOSNodeWithVitals | SyntheticNode

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: caller } = await supabase
    .from('profiles')
    .select('id, role, abo_number, first_name, last_name')
    .eq('clerk_id', userId)
    .single()

  if (!caller) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const { data: losRows } = await supabase.rpc('get_los_members_with_profiles')
  const rows = (losRows ?? []) as LOSRow[]

  // Fetch all active definitions once — these drive completeness display
  const { data: defRows } = await supabase
    .from('vital_sign_definitions')
    .select('id, category')
    .eq('is_active', true)
    .order('sort_order')

  const definitions = (defRows ?? []) as { id: string; category: string }[]

  // Fetch all recorded vital signs (service role bypasses RLS — full table)
  const { data: vsRows } = await supabase
    .from('member_vital_signs')
    .select('profile_id, definition_id, recorded_at, note')

  // Index recorded signs by profile_id → definition_id
  const recordedByProfile: Record<string, Record<string, { recorded_at: string; note: string | null }>> = {}
  for (const vs of vsRows ?? []) {
    const pid = vs.profile_id as string
    if (!recordedByProfile[pid]) recordedByProfile[pid] = {}
    recordedByProfile[pid][vs.definition_id] = { recorded_at: vs.recorded_at, note: vs.note }
  }

  // Build full vital signs list per profile: all definitions, recorded_at/note null if absent
  function vitalsForProfile(profileId: string | null): VitalSign[] {
    if (!profileId) return []
    const recorded = recordedByProfile[profileId] ?? {}
    return definitions.map(def => ({
      definition_id: def.id,
      label: def.category,
      recorded_at: recorded[def.id]?.recorded_at ?? null,
      note: recorded[def.id]?.note ?? null,
    }))
  }

  const allNodes: LOSNodeWithVitals[] = rows.map(row => ({
    ...row,
    vital_signs: vitalsForProfile(row.profile_id),
  }))

  function syntheticSelf(): SyntheticNode {
    return {
      profile_id: caller!.id,
      abo_number: caller!.abo_number,
      sponsor_abo_number: null,
      abo_level: null,
      name: `${caller!.first_name} ${caller!.last_name}`,
      first_name: caller!.first_name,
      last_name: caller!.last_name,
      role: caller!.role as string,
      depth: null,
      country: null, gpv: null, ppv: null, bonus_percent: null,
      group_size: null, qualified_legs: null, annual_ppv: null,
      renewal_date: null, last_synced_at: null,
      vital_signs: vitalsForProfile(caller!.id),
    }
  }

  const role = caller.role as string

  // ── ADMIN: full tree ───────────────────────────────────────────────
  if (role === 'admin') {
    return Response.json({ scope: 'full', nodes: allNodes, caller_abo: caller.abo_number })
  }

  // ── MEMBER / CORE: subtree rooted at caller ────────────────────────────
  if (role === 'member' || role === 'core') {
    if (!caller.abo_number) {
      return Response.json({
        scope: 'subtree',
        nodes: [syntheticSelf()],
        caller_abo: null,
      })
    }

    const childrenOf: Record<string, string[]> = {}
    for (const r of allNodes) {
      if (r.sponsor_abo_number) {
        if (!childrenOf[r.sponsor_abo_number]) childrenOf[r.sponsor_abo_number] = []
        childrenOf[r.sponsor_abo_number].push(r.abo_number)
      }
    }

    const included = new Set<string>()
    const queue = [caller.abo_number]
    while (queue.length > 0) {
      const abo = queue.shift()!
      if (included.has(abo)) continue
      included.add(abo)
      for (const child of childrenOf[abo] ?? []) queue.push(child)
    }

    const subtreeNodes = allNodes.filter(r => included.has(r.abo_number))
    return Response.json({ scope: 'subtree', nodes: subtreeNodes, caller_abo: caller.abo_number })
  }

  // ── GUEST: self + direct upline only ──────────────────────────────────
  const guestNodes: TreeNode[] = []

  const selfRow = caller.abo_number
    ? allNodes.find(r => r.abo_number === caller.abo_number) ?? null
    : null

  if (selfRow) {
    guestNodes.push(selfRow)
    if (selfRow.sponsor_abo_number) {
      const uplineRow = allNodes.find(r => r.abo_number === selfRow.sponsor_abo_number)
      if (uplineRow) guestNodes.push(uplineRow)
    }
  } else {
    guestNodes.push(syntheticSelf())
  }

  return Response.json({ scope: 'guest', nodes: guestNodes, caller_abo: caller.abo_number ?? null })
}
