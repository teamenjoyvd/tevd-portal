// ── Shared types & utilities for the LOS route ───────────────────────────────
// Co-located here per CLAUDE.md: promote to /components only when 2+ unrelated
// routes consume this.

import type { VitalSign } from '@/lib/vitals'
export type { VitalSign } from '@/lib/vitals'
export { isVitalRecorded } from '@/lib/vitals'

export type LOSNode = {
  profile_id: string | null
  abo_number: string | null
  sponsor_abo_number: string | null
  abo_level: string | null
  name: string | null
  first_name: string | null
  last_name: string | null
  role: string | null
  depth: number | null
  country: string | null
  gpv: number | null
  ppv: number | null
  bonus_percent: number | null
  group_size: number | null
  qualified_legs: number | null
  annual_ppv: number | null
  renewal_date: string | null
  vital_signs: VitalSign[]
  children?: LOSNode[]
}

export type TreeResponse = {
  scope: 'full' | 'subtree' | 'guest'
  nodes: LOSNode[]
  caller_abo: string | null
}

// ── Name formatting ───────────────────────────────────────────────────────────
// Single canonical format: First Last. Used in both list and chart views.
export function displayName(node: Pick<LOSNode, 'first_name' | 'last_name' | 'name' | 'abo_number'>): string {
  if (node.first_name && node.last_name) return `${node.first_name} ${node.last_name}`
  return node.name ?? node.abo_number ?? '—'
}

// ── Role colors ───────────────────────────────────────────────────────────────

export type RoleColors = {
  border: string
  labelBg: string
  labelColor: string
  opacity: number
}

const ROLE_COLORS: Record<string, RoleColors> = {
  admin:  { border: '#2d332a',             labelBg: '#2d332a',               labelColor: '#FAF8F3', opacity: 1   },
  core:   { border: '#3E7785',             labelBg: '#3E7785',               labelColor: '#FAF8F3', opacity: 1   },
  member: { border: 'rgba(45,51,42,0.15)', labelBg: 'rgba(62,119,133,0.12)', labelColor: '#3E7785', opacity: 1   },
  guest:  { border: 'rgba(45,51,42,0.08)', labelBg: 'rgba(0,0,0,0.05)',      labelColor: '#8A8577', opacity: 0.6 },
}

export function roleColors(role: string | null): RoleColors {
  return ROLE_COLORS[role ?? 'guest'] ?? ROLE_COLORS.guest
}
