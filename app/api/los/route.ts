import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

type LOSRow = {
  abo_number: string
  sponsor_abo_number: string | null
  abo_level: string | null
  name: string | null
  profile_id: string | null
  first_name: string | null
  last_name: string | null
  role: string | null
  depth: number | null
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, abo_number, first_name, last_name')
    .eq('clerk_id', userId)
    .single()

  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })
  if (!['member', 'core', 'admin'].includes(profile.role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // No ABO number — return bare current_user, empty chains
  if (!profile.abo_number) {
    return Response.json({
      current_user: {
        id: profile.id,
        name: `${profile.first_name} ${profile.last_name}`,
        abo_number: null,
        role: profile.role,
        abo_level: null,
      },
      upline: [],
      downlines: [],
    })
  }

  const { data: losRows } = await supabase.rpc('get_los_members_with_profiles')
  const rows = (losRows ?? []) as LOSRow[]

  // Index by abo_number for fast lookup
  const byAbo: Record<string, LOSRow> = {}
  for (const r of rows) byAbo[r.abo_number] = r

  const currentRow = byAbo[profile.abo_number]

  // Build upline: walk sponsor chain from current user's direct sponsor up to root
  const uplineChain: LOSRow[] = []
  let cursor = currentRow?.sponsor_abo_number ?? null
  const visited = new Set<string>()
  while (cursor && byAbo[cursor] && !visited.has(cursor)) {
    visited.add(cursor)
    uplineChain.push(byAbo[cursor])
    cursor = byAbo[cursor].sponsor_abo_number ?? null
  }
  // uplineChain is currently direct-sponsor → root; reverse to get root → direct-sponsor
  uplineChain.reverse()

  // Build downlines: BFS from current user's abo_number
  // Build children index: parent abo → list of children
  const childrenOf: Record<string, string[]> = {}
  for (const r of rows) {
    if (r.sponsor_abo_number) {
      if (!childrenOf[r.sponsor_abo_number]) childrenOf[r.sponsor_abo_number] = []
      childrenOf[r.sponsor_abo_number].push(r.abo_number)
    }
  }

  const downlines: Array<LOSRow & { relative_level: number }> = []
  const queue: Array<{ abo: string; level: number }> = [
    ...(childrenOf[profile.abo_number] ?? []).map(a => ({ abo: a, level: 1 })),
  ]
  const seen = new Set<string>()
  while (queue.length > 0) {
    const { abo, level } = queue.shift()!
    if (seen.has(abo)) continue
    seen.add(abo)
    const row = byAbo[abo]
    if (!row) continue
    downlines.push({ ...row, relative_level: level })
    for (const child of childrenOf[abo] ?? []) {
      if (!seen.has(child)) queue.push({ abo: child, level: level + 1 })
    }
  }

  function displayName(r: LOSRow): string {
    if (r.first_name && r.last_name) return `${r.first_name} ${r.last_name}`
    return r.name ?? r.abo_number
  }

  return Response.json({
    current_user: {
      id: profile.id,
      name: `${profile.first_name} ${profile.last_name}`,
      abo_number: profile.abo_number,
      role: profile.role,
      abo_level: currentRow?.abo_level ?? null,
    },
    upline: uplineChain.map(r => ({
      abo_number: r.abo_number,
      name: displayName(r),
      role: r.role ?? 'guest',
      abo_level: r.abo_level ?? null,
    })),
    downlines: downlines.map(r => ({
      abo_number: r.abo_number,
      name: displayName(r),
      role: r.role ?? 'guest',
      abo_level: r.abo_level ?? null,
      relative_level: r.relative_level,
    })),
  })
}
