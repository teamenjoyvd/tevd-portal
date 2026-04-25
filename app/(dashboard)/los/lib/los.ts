// ── LOS data transformations ──────────────────────────────────────────────────
// Pure functions — no React imports. Extracted from los/page.tsx per
// REFACTOR-018.

import type { LOSNode } from './los-utils'

/**
 * Build a tree from a flat array of LOSNode records.
 * Links children to parents via sponsor_abo_number.
 * If `rootAbo` is provided, returns only the subtree rooted at that ABO.
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
