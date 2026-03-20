import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

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
  const rows = (losRows ?? []) as Record<string, unknown>[]

  // Attach vital signs to each node keyed by profile_id
  const { data: vsRows } = await supabase
    .from('member_vital_signs')
    .select('profile_id, event_key, event_label, has_ticket, updated_at')

  const vsByProfile: Record<string, { event_key: string; event_label: string; has_ticket: boolean; updated_at: string }[]> = {}
  for (const vs of vsRows ?? []) {
    const pid = vs.profile_id as string
    if (!vsByProfile[pid]) vsByProfile[pid] = []
    vsByProfile[pid].push(vs)
  }

  const allNodes = rows.map(row => ({
    ...row,
    vital_signs: vsByProfile[row.profile_id as string] ?? [],
  }))

  const role = caller.role as string

  // ── ADMIN: full tree ─────────────────────────────────────────────────────
  if (role === 'admin') {
    return Response.json({ scope: 'full', nodes: allNodes, caller_abo: caller.abo_number })
  }

  // ── MEMBER / CORE: subtree rooted at caller ──────────────────────────────
  if (role === 'member' || role === 'core') {
    if (!caller.abo_number) {
      // No ABO — return just themselves with no children
      return Response.json({
        scope: 'subtree',
        nodes: [{
          profile_id: caller.id,
          abo_number: null,
          sponsor_abo_number: null,
          abo_level: null,
          name: `${caller.first_name} ${caller.last_name}`,
          first_name: caller.first_name,
          last_name: caller.last_name,
          role: caller.role,
          depth: null,
          vital_signs: vsByProfile[caller.id] ?? [],
        }],
        caller_abo: null,
      })
    }

    // Collect caller + all descendants via BFS on sponsor_abo_number
    const childrenOf: Record<string, string[]> = {}
    for (const r of allNodes) {
      const sponsor = r.sponsor_abo_number as string | null
      if (sponsor) {
        if (!childrenOf[sponsor]) childrenOf[sponsor] = []
        childrenOf[sponsor].push(r.abo_number as string)
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

    const subtreeNodes = allNodes.filter(r => included.has(r.abo_number as string))

    return Response.json({ scope: 'subtree', nodes: subtreeNodes, caller_abo: caller.abo_number })
  }

  // ── GUEST: self + direct upline only ────────────────────────────────────
  // Find their own row (if they have ABO) and their upline
  const guestNodes: typeof allNodes = []

  const selfRow = caller.abo_number
    ? allNodes.find(r => r.abo_number === caller.abo_number) ?? null
    : null

  if (selfRow) {
    guestNodes.push(selfRow)
    const uplineAbo = selfRow.sponsor_abo_number as string | null
    if (uplineAbo) {
      const uplineRow = allNodes.find(r => r.abo_number === uplineAbo)
      if (uplineRow) guestNodes.push(uplineRow)
    }
  } else {
    // No LOS row — push a synthetic self node from profile data
    guestNodes.push({
      profile_id: caller.id,
      abo_number: null,
      sponsor_abo_number: null,
      abo_level: null,
      name: `${caller.first_name} ${caller.last_name}`,
      first_name: caller.first_name,
      last_name: caller.last_name,
      role: caller.role,
      depth: null,
      vital_signs: [],
    })
  }

  return Response.json({ scope: 'guest', nodes: guestNodes, caller_abo: caller.abo_number ?? null })
}
