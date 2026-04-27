// ── LOS data transformations ──────────────────────────────────────────────────
// Pure TypeScript — no React, no DOM.
// Dashboard-side buildTree. Admin-side equivalent lives in
// app/admin/members/components/los-admin-types.ts (different type, no rootAbo).

import type { LOSNode } from '@/app/(dashboard)/los/lib/los-utils'

/**
 * Builds a tree from a flat node array.
 * rootAbo: when scope === 'subtree', pin the caller's node as the single root.
 * Nodes without abo_number are included as children/roots via profile_id linkage.
 */
export function buildTree(nodes: LOSNode[], rootAbo: string | null): LOSNode[] {
  const byAbo: Record<string, LOSNode> = {}
  const allNodes = nodes.map(n => {
    const copy = { ...n, children: [] }
    if (n.abo_number) byAbo[n.abo_number] = copy
    return copy
  })

  const roots: LOSNode[] = []
  for (const n of allNodes) {
    const parent = n.sponsor_abo_number ? byAbo[n.sponsor_abo_number] : null
    if (parent) {
      parent.children!.push(n)
    } else {
      roots.push(n)
    }
  }

  if (rootAbo && byAbo[rootAbo]) return [byAbo[rootAbo]]
  return roots
}
