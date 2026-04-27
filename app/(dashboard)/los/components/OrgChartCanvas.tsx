'use client'

import { useRef, useState, useEffect, useMemo } from 'react'
import { displayName, roleColors } from '../lib/los-utils'
import type { LOSNode } from '../lib/los-utils'
import {
  type LayoutNode,
  CARD_W, CARD_H, GAP_X, GAP_Y,
  capDepth, buildWidthMap, layoutNode,
  flattenLayout, collectEdges, canvasBounds,
} from '@/lib/orgchart-math'

export type { LOSNode }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number | null): string {
  if (v == null) return '—'
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── OrgChartNode card ─────────────────────────────────────────────────────────

function OrgChartNode({ ln }: { ln: LayoutNode }) {
  const { node, x, y } = ln
  const colors = roleColors(node.role)
  const name = displayName(node)

  return (
    <foreignObject x={x - CARD_W / 2} y={y} width={CARD_W} height={CARD_H} style={{ overflow: 'visible' }}>
      <div
        style={{
          width: CARD_W, height: CARD_H, borderRadius: 12,
          border: `1px solid ${colors.border}`, backgroundColor: 'var(--bg-card)',
          padding: '8px 10px', boxSizing: 'border-box',
          display: 'flex', flexDirection: 'column', gap: 2, userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginBottom: 2 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', flex: 1,
            lineHeight: 1.25, overflow: 'hidden',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>{name}</span>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99,
            backgroundColor: colors.labelBg, color: colors.labelColor,
            flexShrink: 0, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>{node.role ?? 'guest'}</span>
        </div>
        {node.bonus_percent != null && (
          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{node.bonus_percent}%</span>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '0.02em' }}>ЛТС</span>
          <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-primary)' }}>{fmt(node.ppv)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '0.02em' }}>ГТС</span>
          <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-primary)' }}>{fmt(node.gpv)}</span>
        </div>
        {node.group_size != null && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
            <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>👥</span>
            <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{node.group_size}</span>
          </div>
        )}
      </div>
    </foreignObject>
  )
}

// ── Bezier edge ───────────────────────────────────────────────────────────────

function OrgChartEdge({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const midY = (y1 + y2) / 2
  const d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`
  return <path d={d} fill="none" stroke="var(--border-default)" strokeWidth={1.5} />
}

// ── Inner canvas (pan + zoom) ─────────────────────────────────────────────────

type OrgChartInnerProps = {
  nodes: LayoutNode[]
  edges: Array<{ x1: number; y1: number; x2: number; y2: number }>
  svgW: number
  svgH: number
}

function OrgChartInner({ nodes, edges, svgW, svgH }: OrgChartInnerProps) {
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const dragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }
    setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }))
  }
  const onPointerUp = () => { dragging.current = false }

  // React synthetic onWheel is passive in Chrome/Safari — attach native listener.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setTransform(t => ({ ...t, scale: Math.max(0.3, Math.min(2.5, t.scale * delta)) }))
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}
        style={{
          position: 'absolute', top: 8, right: 8, zIndex: 10,
          fontSize: 11, fontWeight: 600, padding: '4px 10px',
          borderRadius: 8, border: '1px solid var(--border-default)',
          backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', cursor: 'pointer',
        }}
      >Reset</button>
      <div
        ref={containerRef}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
        style={{
          width: '100%', overflowX: 'auto', overflowY: 'hidden',
          cursor: 'grab', borderRadius: 16,
          border: '1px solid var(--border-default)',
          backgroundColor: 'var(--bg-global)', minHeight: 200,
        }}
      >
        <svg
          width={svgW} height={svgH}
          style={{
            display: 'block',
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: 'top center',
          }}
        >
          <g>{edges.map((e, i) => <OrgChartEdge key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} />)}</g>
          <g>{nodes.map((ln, i) => <OrgChartNode key={ln.node.abo_number ?? ln.node.profile_id ?? i} ln={ln} />)}</g>
        </svg>
      </div>
    </div>
  )
}

// ── OrgChartCanvas ────────────────────────────────────────────────────────────
// Computes layout and passes resetKey as key prop to OrgChartInner so React
// remounts it (resetting transform) when roots or maxDepth change.

export function OrgChartCanvas({ roots, maxDepth }: { roots: LOSNode[]; maxDepth: number }) {
  const { nodes, edges, svgW, svgH, resetKey } = useMemo(() => {
    const PADDING = 40
    const cappedRoots = roots.map(r => capDepth(r, maxDepth))
    const widthMap = new Map<LOSNode, number>()
    cappedRoots.forEach(r => buildWidthMap(r, widthMap))
    const rootLayouts: LayoutNode[] = []
    let cursor = PADDING
    for (const root of cappedRoots) {
      const w = widthMap.get(root) ?? CARD_W
      rootLayouts.push(layoutNode(root, cursor + w / 2, PADDING, widthMap))
      cursor += w + GAP_X * 2
    }
    const allNodes = rootLayouts.flatMap(flattenLayout)
    const allEdges = rootLayouts.flatMap(collectEdges)
    const bounds = canvasBounds(allNodes)
    const key = `${maxDepth}:${roots.map(r => r.abo_number ?? r.profile_id ?? '').join(',')}`
    return {
      nodes: allNodes, edges: allEdges,
      svgW: Math.max(bounds.maxX + PADDING, 320),
      svgH: bounds.maxY + PADDING,
      resetKey: key,
    }
  }, [roots, maxDepth])

  return <OrgChartInner key={resetKey} nodes={nodes} edges={edges} svgW={svgW} svgH={svgH} />
}
