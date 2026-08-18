'use client'

// Minimized, change-highlighted preview of the sub-tree a submission updates.
// Reuses buildTree (lib/los.ts) + the org-chart layout math (lib/orgchart-math.ts)
// + the LOS card styling, so "which part is being updated" reads the same as the
// dashboard org chart. Depth-capped to stay minimized for large trees.

import { useMemo } from 'react'
import { buildTree } from '@/lib/los'
import type { LOSNode } from '@/app/(dashboard)/los/lib/los-utils'
import {
  CARD_W, CARD_H,
  capDepth, buildWidthMap, layoutNode,
  flattenLayout, collectEdges, canvasBounds,
} from '@/lib/orgchart-math'

export type ChangeStatus = 'new' | 'level' | 'bonus' | 'unchanged'

/* The three change kinds are success / info / pending: they need a tint plus a
   foreground legible on it in both themes, which is exactly what the status
   pairs are. #3d405b (level) is one of the contrast suspects #741 names by hex
   — it had no dark override and no token to move to. */
const STATUS_STYLE: Record<ChangeStatus, { border: string; bg: string; label: string; color: string }> = {
  new:       { border: 'var(--status-success-fg)', bg: 'var(--status-success-bg)', label: 'new',   color: 'var(--status-success-fg)' },
  level:     { border: 'var(--status-info-fg)',    bg: 'var(--status-info-bg)',    label: 'level', color: 'var(--status-info-fg)'    },
  bonus:     { border: 'var(--status-pending-fg)', bg: 'var(--status-pending-bg)', label: 'bonus', color: 'var(--status-pending-fg)' },
  unchanged: { border: 'rgba(var(--brand-forest-rgb), 0.15)', bg: 'var(--bg-card)', label: '',   color: 'var(--text-secondary)' },
}

// Map a parsed CSV row to the minimal LOSNode shape buildTree/layout need.
function rowToNode(r: Record<string, string>): LOSNode {
  return {
    profile_id: null,
    abo_number: r.abo_number ?? null,
    sponsor_abo_number: r.sponsor_abo_number || null,
    abo_level: r.abo_level ?? null,
    name: r.name ?? null,
    first_name: null,
    last_name: null,
    role: null,
    depth: null,
    country: r.country ?? null,
    gpv: null,
    ppv: null,
    bonus_percent: r.bonus_percent ? Number(r.bonus_percent) : null,
    group_size: null,
    qualified_legs: null,
    annual_ppv: null,
    renewal_date: null,
    vital_signs: [],
  }
}

export type NodeMeta = { lastUpdated?: string | null; byUpline?: boolean }

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function SubtreePreview({
  rows,
  anchorAbo,
  changeStatus,
  meta,
  maxDepth = 3,
}: {
  rows: Record<string, string>[]
  anchorAbo: string | null
  changeStatus?: Record<string, ChangeStatus>
  meta?: Record<string, NodeMeta>
  maxDepth?: number
}) {
  const { layout, edges, bounds } = useMemo(() => {
    const nodes = rows.map(rowToNode)
    const roots = buildTree(nodes, anchorAbo)
    if (roots.length === 0) return { layout: [], edges: [], bounds: { maxX: 0, maxY: 0 } }
    // Single virtual anchor: use the first root (for a valid CORE submission there is one).
    const capped = capDepth(roots[0], maxDepth)
    const widthMap = new Map<LOSNode, number>()
    buildWidthMap(capped, widthMap)
    const rootLayout = layoutNode(capped, (widthMap.get(capped) ?? CARD_W) / 2, 0, widthMap)
    const flat = flattenLayout(rootLayout)
    return { layout: flat, edges: collectEdges(rootLayout), bounds: canvasBounds(flat) }
  }, [rows, anchorAbo, maxDepth])

  if (layout.length === 0) {
    return (
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        No sub-tree to preview.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-container border p-3" style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-card)' }}>
      <svg width={bounds.maxX + 20} height={bounds.maxY + 20} style={{ display: 'block' }}>
        {edges.map((e, i) => (
          <path
            key={i}
            d={`M ${e.x1} ${e.y1} C ${e.x1} ${(e.y1 + e.y2) / 2}, ${e.x2} ${(e.y1 + e.y2) / 2}, ${e.x2} ${e.y2}`}
            fill="none"
            stroke="var(--border-default)"
            strokeWidth={1.5}
          />
        ))}
        {layout.map(ln => {
          const abo = ln.node.abo_number ?? ''
          const status = changeStatus?.[abo] ?? 'unchanged'
          const s = STATUS_STYLE[status]
          const m = meta?.[abo]
          return (
            <foreignObject key={abo} x={ln.x - CARD_W / 2} y={ln.y} width={CARD_W} height={CARD_H} style={{ overflow: 'visible' }}>
              <div style={{
                width: CARD_W, height: CARD_H, borderRadius: 12,
                border: `1.5px solid ${s.border}`, backgroundColor: s.bg,
                padding: '8px 10px', boxSizing: 'border-box',
                display: 'flex', flexDirection: 'column', gap: 3, userSelect: 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', flex: 1, lineHeight: 1.25, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {ln.node.name ?? abo}
                  </span>
                  {s.label && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99, backgroundColor: s.border, color: 'var(--on-accent)', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {s.label}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{abo}</span>
                {ln.node.abo_level && (
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Level {ln.node.abo_level}</span>
                )}
                {m?.lastUpdated && (
                  <span style={{ fontSize: 9, marginTop: 'auto', color: m.byUpline ? 'var(--status-pending-fg)' : 'var(--text-tertiary)', fontWeight: m.byUpline ? 600 : 400 }}>
                    upd {fmtShort(m.lastUpdated)}{m.byUpline ? ' · upline' : ''}
                  </span>
                )}
              </div>
            </foreignObject>
          )
        })}
      </svg>
    </div>
  )
}
