// ── Admin LOS types and helpers ───────────────────────────────────────────────
// Plain TypeScript — no React, no DOM, no 'use client'.
// Admin-side tree uses TreeNode (vital signs data).
// Dashboard-side tree uses LOSNode (financial data) — do not unify.

import type { VitalSign } from '@/lib/vitals'

export type { VitalSign }

export type VitalSignDefinition = {
  id: string
  category: string
  label: string | null
  is_active: boolean
  sort_order: number
}

export type TreeNode = {
  profile_id: string
  abo_number: string
  name: string | null
  first_name: string
  last_name: string
  role: string
  abo_level: string | null
  depth: number | null
  sponsor_abo_number: string | null
  vital_signs: VitalSign[]
  children?: TreeNode[]
}

export type LosTreeResponse = {
  scope: 'full' | 'subtree' | 'guest'
  nodes: TreeNode[]
  caller_abo: string | null
}

/**
 * Builds a tree from a flat admin TreeNode array.
 * No rootAbo arg — admin always gets the full tree.
 */
export function buildTree(nodes: TreeNode[]): TreeNode[] {
  if (!Array.isArray(nodes)) return []
  const byAbo: Record<string, TreeNode> = {}
  const roots: TreeNode[] = []
  for (const n of nodes) { byAbo[n.abo_number] = { ...n, children: [] } }
  for (const n of Object.values(byAbo)) {
    if (n.sponsor_abo_number && byAbo[n.sponsor_abo_number]) {
      byAbo[n.sponsor_abo_number].children!.push(n)
    } else {
      roots.push(n)
    }
  }
  return roots
}
