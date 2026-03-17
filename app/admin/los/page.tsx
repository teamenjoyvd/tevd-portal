'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

type VitalSign = { event_key: string; event_label: string; has_ticket: boolean }

type TreeNode = {
  profile_id: string
  abo_number: string
  name: string | null
  first_name: string
  last_name: string
  role: string
  abo_level: string | null
  depth: number
  sponsor_abo_number: string | null
  vital_signs: VitalSign[]
  children?: TreeNode[]
}

const ROLE_STYLES: Record<string, { bg: string; color: string }> = {
  admin:  { bg: '#2d332a', color: '#FAF8F3' },
  core:   { bg: '#3E7785', color: '#FAF8F3' },
  member: { bg: 'rgba(62,119,133,0.15)', color: '#3E7785' },
  guest:  { bg: 'rgba(0,0,0,0.06)', color: '#8A8577' },
}

// Build tree from flat list
function buildTree(nodes: TreeNode[]): TreeNode[] {
  const byAbo: Record<string, TreeNode> = {}
  const roots: TreeNode[] = []

  for (const n of nodes) {
    byAbo[n.abo_number] = { ...n, children: [] }
  }
  for (const n of Object.values(byAbo)) {
    if (n.sponsor_abo_number && byAbo[n.sponsor_abo_number]) {
      byAbo[n.sponsor_abo_number].children!.push(n)
    } else {
      roots.push(n)
    }
  }
  return roots
}

const DEMO_EVENTS = [
  { event_key: 'spring_convention_2026', event_label: 'Spring Convention 2026' },
  { event_key: 'leadership_summit_2026', event_label: 'Leadership Summit 2026' },
]

function NodeCard({
  node,
  events,
  onToggle,
  isPending,
}: {
  node: TreeNode
  events: { event_key: string; event_label: string }[]
  onToggle: (profileId: string, event_key: string, event_label: string, has_ticket: boolean) => void
  isPending: boolean
}) {
  const [expanded, setExpanded] = useState(node.depth < 2)
  const rs = ROLE_STYLES[node.role] ?? ROLE_STYLES.guest
  const hasChildren = (node.children?.length ?? 0) > 0
  const displayName = node.first_name
    ? `${node.first_name} ${node.last_name}`
    : node.name ?? node.abo_number

  return (
    <div className="relative">
      {/* Connector line for non-root nodes */}
      <div className="rounded-xl p-4 mb-1"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-start gap-3">
          {/* Expand/collapse */}
          {hasChildren ? (
            <button onClick={() => setExpanded(e => !e)}
              className="w-5 h-5 flex items-center justify-center rounded flex-shrink-0 mt-0.5 transition-colors hover:bg-black/10"
              style={{ color: 'var(--text-secondary)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          ) : <div className="w-5 flex-shrink-0" />}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-body text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {displayName}
              </span>
              <span className="font-body text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: rs.bg, color: rs.color }}>
                {node.role}
              </span>
              {node.abo_level && (
                <span className="font-body text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                  {node.abo_level}
                </span>
              )}
              <span className="font-body text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                #{node.abo_number}
              </span>
            </div>

            {/* Vital signs checkboxes */}
            <div className="flex flex-wrap gap-3 mt-2">
              {events.map(ev => {
                const vs = node.vital_signs.find(v => v.event_key === ev.event_key)
                const checked = vs?.has_ticket ?? false
                return (
                  <label key={ev.event_key}
                    className="flex items-center gap-1.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isPending}
                      onChange={() => onToggle(node.profile_id, ev.event_key, ev.event_label, !checked)}
                      className="w-3.5 h-3.5 rounded accent-[var(--brand-crimson)]"
                    />
                    <span className="text-[11px] font-body transition-colors"
                      style={{ color: checked ? 'var(--brand-crimson)' : 'var(--text-secondary)' }}>
                      {ev.event_label}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Depth badge */}
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
            D{node.depth}
          </span>
        </div>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div className="ml-6 pl-4 border-l" style={{ borderColor: 'var(--border-default)' }}>
          {node.children!.map(child => (
            <NodeCard key={child.abo_number} node={child} events={events}
              onToggle={onToggle} isPending={isPending} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminLOSPage() {
  const qc = useQueryClient()
  const [events] = useState(DEMO_EVENTS)

  const { data: flatNodes = [], isLoading } = useQuery<TreeNode[]>({
    queryKey: ['los-tree'],
    queryFn: () => fetch('/api/los/tree').then(r => r.json()),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ profileId, event_key, event_label, has_ticket }: {
      profileId: string; event_key: string; event_label: string; has_ticket: boolean
    }) =>
      fetch(`/api/admin/vital-signs/${profileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_key, event_label, has_ticket }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['los-tree'] }),
  })

  const treeRoots = buildTree(flatNodes)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            Line of Sponsorship
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Full org tree with vital signs. Click a checkbox to toggle event attendance.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <span>{flatNodes.length} members</span>
        </div>
      </div>

      {/* Event legend */}
      <div className="rounded-xl p-4 flex flex-wrap gap-4"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--brand-crimson)' }}>
          Events
        </span>
        {events.map(ev => (
          <span key={ev.event_key} className="text-xs font-body" style={{ color: 'var(--text-secondary)' }}>
            ✓ {ev.event_label}
          </span>
        ))}
      </div>

      {/* Tree */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse"
              style={{ backgroundColor: 'var(--border-default)' }} />
          ))}
        </div>
      ) : treeRoots.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No LOS data yet.</p>
      ) : (
        <div className="space-y-1">
          {treeRoots.map(node => (
            <NodeCard
              key={node.abo_number}
              node={node}
              events={events}
              onToggle={(profileId, event_key, event_label, has_ticket) =>
                toggleMutation.mutate({ profileId, event_key, event_label, has_ticket })
              }
              isPending={toggleMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}
