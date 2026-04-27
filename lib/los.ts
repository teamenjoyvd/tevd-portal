// ── LOS data transformations ──────────────────────────────────────────────────
// Pure TypeScript — no React, no DOM.
// Dashboard-side buildTree. Admin-side equivalent lives in
// app/admin/members/components/los-admin-types.ts (different type, no rootAbo).

import type { LOSNode } from '@/app/(dashboard)/los/lib/los-utils'

/**
 * Builds a tree from a flat node array.
 * rootAbo: when scope === 'subtree', pin the caller's node as the single root.
 */
export function buildTree(nodes: LOSNode[], rootAbo: string | null): LOSNode[] {
  const byAbo: Record<string, LOSNode> = {}
  for (const n of nodes) {
    if (n.abo_number) byAbo[n.abo_number] = { ...n, children: [] }
  }
  const roots: LOSNode[] = []
  for (const n of Object.values(byAbo)) {
    const parent = n.sponsor_abo_number ? byAbo[n.sponsor_abo_number] : null
    if (parent) parent.children!.push(n)
    else roots.push(n)
  }
  if (rootAbo && byAbo[rootAbo]) return [byAbo[rootAbo]]
  return roots
}
