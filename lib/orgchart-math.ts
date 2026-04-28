// ── OrgChart layout math ─────────────────────────────────────────────────────
// Pure TypeScript — no React, no DOM. All functions are side-effect-free.
// Consumed by OrgChartCanvas.tsx.

import type { LOSNode } from '@/app/(dashboard)/los/lib/los-utils'

// ── Layout type ───────────────────────────────────────────────────────────────

export type LayoutNode = {
  node: LOSNode
  x: number   // center x
  y: number   // top y
  children: LayoutNode[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const CARD_W = 160
export const CARD_H = 108
export const GAP_X  = 24
export const GAP_Y  = 56

// ── Depth cap ─────────────────────────────────────────────────────────────────

export function capDepth(node: LOSNode, maxDepth: number, current = 0): LOSNode {
  if (current >= maxDepth) return { ...node, children: [] }
  return {
    ...node,
    children: (node.children ?? []).map(c => capDepth(c, maxDepth, current + 1)),
  }
}

// ── Layout algorithm (single bottom-up pass, O(N)) ────────────────────────────
// buildWidthMap memoizes subtree widths so each node is measured exactly once.

export function buildWidthMap(node: LOSNode, map: Map<LOSNode, number>): number {
  const children = node.children ?? []
  if (children.length === 0) {
    map.set(node, CARD_W)
    return CARD_W
  }
  const childrenWidth = children.reduce((sum, c) => sum + buildWidthMap(c, map), 0)
  const w = Math.max(CARD_W, childrenWidth + GAP_X * (children.length - 1))
  map.set(node, w)
  return w
}

export function layoutNode(
  node: LOSNode,
  cx: number,
  y: number,
  widthMap: Map<LOSNode, number>,
): LayoutNode {
  const children = node.children ?? []
  if (children.length === 0) return { node, x: cx, y, children: [] }
  const childWidths = children.map(c => widthMap.get(c) ?? CARD_W)
  const innerWidth = childWidths.reduce((s, w) => s + w, 0) + GAP_X * (children.length - 1)
  let cursor = cx - innerWidth / 2
  const layoutChildren = children.map((child, i) => {
    const w = childWidths[i]
    const childCx = cursor + w / 2
    cursor += w + GAP_X
    return layoutNode(child, childCx, y + CARD_H + GAP_Y, widthMap)
  })
  return { node, x: cx, y, children: layoutChildren }
}

export function flattenLayout(root: LayoutNode): LayoutNode[] {
  const result: LayoutNode[] = [root]
  for (const c of root.children) result.push(...flattenLayout(c))
  return result
}

export function collectEdges(
  root: LayoutNode,
): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const edges: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
  function walk(n: LayoutNode) {
    for (const child of n.children) {
      edges.push({ x1: n.x, y1: n.y + CARD_H, x2: child.x, y2: child.y })
      walk(child)
    }
  }
  walk(root)
  return edges
}

export function canvasBounds(nodes: LayoutNode[]): { maxX: number; maxY: number } {
  let maxX = 0, maxY = 0
  for (const n of nodes) {
    maxX = Math.max(maxX, n.x + CARD_W / 2)
    maxY = Math.max(maxY, n.y + CARD_H)
  }
  return { maxX, maxY }
}
