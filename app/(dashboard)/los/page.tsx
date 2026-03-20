'use client'

import { useQuery } from '@tanstack/react-query'
import { formatDate } from '@/lib/format'

// ── Types ─────────────────────────────────────────────────────────────────────

type VitalSign = {
  event_key: string
  event_label: string
  has_ticket: boolean
  updated_at: string
}

type LOSNode = {
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
  // computed
  children?: LOSNode[]
}

type TreeResponse = {
  scope: 'full' | 'subtree' | 'guest'
  nodes: LOSNode[]
  caller_abo: string | null
}

// ── Tree builder ──────────────────────────────────────────────────────────────

function buildTree(nodes: LOSNode[], rootAbo: string | null): LOSNode[] {
  const byAbo: Record<string, LOSNode> = {}
  for (const n of nodes) {
    if (n.abo_number) byAbo[n.abo_number] = { ...n, children: [] }
  }

  const roots: LOSNode[] = []
  for (const n of Object.values(byAbo)) {
    const parent = n.sponsor_abo_number ? byAbo[n.sponsor_abo_number] : null
    if (parent) {
      parent.children!.push(n)
    } else {
      roots.push(n)
    }
  }

  // If scoped to a specific root abo, return just that subtree
  if (rootAbo && byAbo[rootAbo]) return [byAbo[rootAbo]]
  return roots
}

function displayName(node: LOSNode): string {
  if (node.first_name && node.last_name) return `${node.first_name} ${node.last_name}`
  return node.name ?? node.abo_number ?? '—'
}

// ── Role color system ─────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, { border: string; labelBg: string; labelColor: string; opacity: number }> = {
  admin:  { border: '#2d332a',            labelBg: '#2d332a',              labelColor: '#FAF8F3', opacity: 1    },
  core:   { border: '#3E7785',            labelBg: '#3E7785',              labelColor: '#FAF8F3', opacity: 1    },
  member: { border: 'rgba(45,51,42,0.15)', labelBg: 'rgba(62,119,133,0.12)', labelColor: '#3E7785', opacity: 1  },
  guest:  { border: 'rgba(45,51,42,0.08)', labelBg: 'rgba(0,0,0,0.05)',    labelColor: '#8A8577', opacity: 0.6 },
}

function roleColors(role: string | null) {
  return ROLE_COLORS[role ?? 'guest'] ?? ROLE_COLORS.guest
}

// ── Member info tooltip / expanded card ──────────────────────────────────────

function MemberCard({ node, isExpanded, onToggle }: {
  node: LOSNode
  isExpanded: boolean
  onToggle: () => void
}) {
  const rc = roleColors(node.role)
  const name = displayName(node)
  const hasVitals = node.vital_signs.length > 0
  const hasStats = node.gpv || node.ppv || node.group_size || node.abo_level

  return (
    <div
      className="rounded-xl mb-1.5 overflow-hidden transition-all"
      style={{
        border: `1px solid ${rc.border}`,
        opacity: rc.opacity,
        backgroundColor: 'var(--bg-card)',
      }}
    >
      {/* Main row */}
      <div
        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-black/[0.02] transition-colors"
        onClick={onToggle}
      >
        {/* Expand chevron */}
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className="flex-shrink-0 transition-transform"
          style={{
            color: 'var(--text-tertiary)',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>

        {/* Name */}
        <span className="text-sm font-semibold flex-1 min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>
          {name}
        </span>

        {/* ABO number */}
        {node.abo_number && (
          <span className="text-xs font-mono flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
            {node.abo_number}
          </span>
        )}

        {/* Role pill */}
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 uppercase tracking-wide"
          style={{ backgroundColor: rc.labelBg, color: rc.labelColor }}
        >
          {node.role ?? 'guest'}
        </span>

        {/* ABO level */}
        {node.abo_level && (
          <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
            {node.abo_level}%
          </span>
        )}

        {/* Vital sign dots (collapsed preview) */}
        {!isExpanded && hasVitals && (
          <div className="flex gap-1 flex-shrink-0">
            {node.vital_signs.map(vs => (
              <span
                key={vs.event_key}
                title={`${vs.event_label}: ${vs.has_ticket ? 'ticketed' : 'no ticket'}`}
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: vs.has_ticket ? 'var(--brand-crimson)' : 'rgba(0,0,0,0.12)' }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Expanded detail panel */}
      {isExpanded && (
        <div
          className="px-4 pb-4 pt-1 space-y-3"
          style={{ borderTop: '1px solid var(--border-default)' }}
        >
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">

            {/* LOS stats */}
            {hasStats && (
              <>
                {node.abo_level && (
                  <Stat label="ABO Level" value={`${node.abo_level}%`} />
                )}
                {node.gpv != null && (
                  <Stat label="GPV" value={node.gpv.toLocaleString('de-DE', { maximumFractionDigits: 0 })} />
                )}
                {node.ppv != null && (
                  <Stat label="PPV" value={node.ppv.toLocaleString('de-DE', { maximumFractionDigits: 0 })} />
                )}
                {node.bonus_percent != null && (
                  <Stat label="Bonus %" value={`${node.bonus_percent}%`} />
                )}
                {node.group_size != null && (
                  <Stat label="Group size" value={String(node.group_size)} />
                )}
                {node.qualified_legs != null && (
                  <Stat label="Qualified legs" value={String(node.qualified_legs)} />
                )}
                {node.annual_ppv != null && (
                  <Stat label="Annual PPV" value={node.annual_ppv.toLocaleString('de-DE', { maximumFractionDigits: 0 })} />
                )}
                {node.renewal_date && (
                  <Stat label="Renewal date" value={formatDate(node.renewal_date)} />
                )}
                {node.country && (
                  <Stat label="Country" value={node.country} />
                )}
              </>
            )}

            {/* Profile stats (only if profile is linked) */}
            {node.profile_id && node.depth != null && (
              <Stat label="Tree depth" value={String(node.depth)} />
            )}
          </div>

          {/* Vital signs */}
          {hasVitals && (
            <div>
              <p className="text-[10px] font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>
                Vital Signs
              </p>
              <div className="flex flex-wrap gap-2">
                {node.vital_signs.map(vs => (
                  <span
                    key={vs.event_key}
                    className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{
                      backgroundColor: vs.has_ticket ? 'rgba(188,71,73,0.12)' : 'rgba(0,0,0,0.05)',
                      color: vs.has_ticket ? 'var(--brand-crimson)' : 'var(--text-secondary)',
                    }}
                  >
                    {vs.has_ticket ? '✓' : '○'} {vs.event_label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {!hasStats && !hasVitals && (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>No additional data available.</p>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>{value}</p>
    </div>
  )
}

// ── Recursive tree node ───────────────────────────────────────────────────────

function TreeNode({
  node,
  depth,
  expanded,
  onToggleExpand,
}: {
  node: LOSNode
  depth: number
  expanded: Set<string>
  onToggleExpand: (key: string) => void
}) {
  const key = node.abo_number ?? node.profile_id ?? 'unknown'
  const isExpanded = expanded.has(key)
  const hasChildren = (node.children?.length ?? 0) > 0

  return (
    <div style={{ paddingLeft: depth > 0 ? 20 : 0 }}>
      <MemberCard
        node={node}
        isExpanded={isExpanded}
        onToggle={() => onToggleExpand(key)}
      />
      {hasChildren && (
        <div style={{ borderLeft: '2px solid var(--border-default)', marginLeft: 10, paddingLeft: 10 }}>
          {node.children!.map(child => (
            <TreeNode
              key={child.abo_number ?? child.profile_id ?? Math.random()}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Guest view ────────────────────────────────────────────────────────────────

function GuestView({ nodes, callerAbo }: { nodes: LOSNode[]; callerAbo: string | null }) {
  const self = nodes.find(n => n.abo_number === callerAbo) ?? nodes[0]
  const upline = nodes.find(n => n.abo_number !== callerAbo)

  return (
    <div className="space-y-4">
      {upline && (
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>
            Your Upline
          </p>
          <div
            className="rounded-xl px-4 py-3 flex items-center gap-3"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
          >
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {displayName(upline)}
            </span>
            {upline.abo_number && (
              <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
                {upline.abo_number}
              </span>
            )}
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ml-auto"
              style={{ backgroundColor: roleColors(upline.role).labelBg, color: roleColors(upline.role).labelColor }}
            >
              {upline.role ?? 'member'}
            </span>
          </div>
        </div>
      )}
      {self && (
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>
            You
          </p>
          <div
            className="rounded-xl px-4 py-3 flex items-center gap-3"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)', opacity: 0.7 }}
          >
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {displayName(self)}
            </span>
            {self.abo_number && (
              <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
                {self.abo_number}
              </span>
            )}
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ml-auto"
              style={{ backgroundColor: roleColors(self.role).labelBg, color: roleColors(self.role).labelColor }}
            >
              {self.role ?? 'guest'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LOSPage() {
  const { data, isLoading, isError } = useQuery<TreeResponse>({
    queryKey: ['los-tree'],
    queryFn: () => fetch('/api/los/tree').then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  })

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  function toggleExpand(key: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function expandAll(nodes: LOSNode[]) {
    const keys = new Set<string>()
    function collect(n: LOSNode) {
      if (n.abo_number) keys.add(n.abo_number)
      else if (n.profile_id) keys.add(n.profile_id)
      for (const c of n.children ?? []) collect(c)
    }
    nodes.forEach(collect)
    setExpanded(keys)
  }

  const tree: LOSNode[] = data
    ? buildTree(data.nodes, data.scope === 'subtree' ? data.caller_abo : null)
    : []

  // Search: filter flat nodes by name or ABO, then rebuild — only active when search has value
  const searchLower = search.toLowerCase().trim()
  const filteredTree: LOSNode[] = searchLower
    ? (() => {
        const matched = (data?.nodes ?? []).filter(n => {
          const name = displayName(n).toLowerCase()
          return name.includes(searchLower) || (n.abo_number ?? '').includes(searchLower)
        })
        // Re-run buildTree on all nodes but only render matched as roots (flat list in search mode)
        return matched.map(n => ({ ...n, children: [] }))
      })()
    : tree

  const scopeLabel = data?.scope === 'full'
    ? 'Full Tree'
    : data?.scope === 'subtree'
    ? 'Your Network'
    : 'Your Upline'

  return (
    <div className="py-8 pb-16">
      <div className="max-w-[960px] mx-auto px-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              LOS
            </h1>
            {data && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {scopeLabel} · {data.nodes.length} member{data.nodes.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {[
              { role: 'admin',  label: 'Admin'  },
              { role: 'core',   label: 'Core'   },
              { role: 'member', label: 'Member' },
              { role: 'guest',  label: 'Guest'  },
            ].map(({ role, label }) => {
              const rc = roleColors(role)
              return (
                <div key={role} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: rc.labelBg, border: `1px solid ${rc.border}`, opacity: rc.opacity }}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Search + controls — only for tree views (not guest) */}
        {data?.scope !== 'guest' && (
          <div className="flex items-center gap-3 mb-5">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or ABO…"
              className="flex-1 border rounded-xl px-3 py-2 text-sm"
              style={{
                borderColor: 'var(--border-default)',
                color: 'var(--text-primary)',
                backgroundColor: 'var(--bg-global)',
              }}
            />
            {!searchLower && (
              <>
                <button
                  onClick={() => expandAll(tree)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold border transition-colors hover:bg-black/5 flex-shrink-0"
                  style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                >
                  Expand all
                </button>
                <button
                  onClick={() => setExpanded(new Set())}
                  className="px-3 py-2 rounded-xl text-xs font-semibold border transition-colors hover:bg-black/5 flex-shrink-0"
                  style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                >
                  Collapse all
                </button>
              </>
            )}
          </div>
        )}

        {/* States */}
        {isLoading && (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-10 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--border-default)' }} />
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--brand-crimson)' }}>Failed to load LOS data.</p>
          </div>
        )}

        {/* Guest view */}
        {!isLoading && !isError && data?.scope === 'guest' && (
          <GuestView nodes={data.nodes} callerAbo={data.caller_abo} />
        )}

        {/* Tree view */}
        {!isLoading && !isError && data?.scope !== 'guest' && (
          <>
            {filteredTree.length === 0 && (
              <p className="text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>
                {searchLower ? 'No members match your search.' : 'No data available.'}
              </p>
            )}
            {filteredTree.map(node => (
              <TreeNode
                key={node.abo_number ?? node.profile_id ?? Math.random()}
                node={node}
                depth={0}
                expanded={expanded}
                onToggleExpand={toggleExpand}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// useState import — needs to be at top of file
import { useState } from 'react'
