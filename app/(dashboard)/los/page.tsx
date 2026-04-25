'use client'

import { useState, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatDate } from '@/lib/format'
import { OrgChartCanvas } from './components/OrgChartCanvas'
import { displayName, roleColors, isVitalRecorded } from './lib/los-utils'
import type { LOSNode, TreeResponse } from './lib/los-utils'
import { buildTree } from './lib/los'
import { apiClient } from '@/lib/apiClient'

// ── Stat subcomponent ─────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>{value}</p>
    </div>
  )
}

// ── MemberCard ────────────────────────────────────────────────────────────────

const STAT_FIELDS = [
  'gpv', 'ppv', 'bonus_percent', 'group_size',
  'qualified_legs', 'annual_ppv', 'renewal_date', 'country', 'depth',
] as const

function MemberCard({ node, isExpanded, onToggle }: {
  node: LOSNode
  isExpanded: boolean
  onToggle: () => void
}) {
  const rc = roleColors(node.role)
  const name = displayName(node)
  const hasVitals = node.vital_signs.length > 0
  const hasStats = STAT_FIELDS.some(k => node[k] != null)

  return (
    <div
      className="rounded-xl mb-1.5 overflow-hidden"
      style={{ border: `1px solid ${rc.border}`, opacity: rc.opacity, backgroundColor: 'var(--bg-card)' }}
    >
      <div
        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-black/[0.02] transition-colors"
        onClick={onToggle}
      >
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className="flex-shrink-0 transition-transform"
          style={{ color: 'var(--text-tertiary)', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="text-sm font-semibold flex-1 min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>
          {name}
        </span>
        {node.abo_number && (
          <span className="text-xs font-mono flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
            {node.abo_number}
          </span>
        )}
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 uppercase tracking-wide"
          style={{ backgroundColor: rc.labelBg, color: rc.labelColor }}
        >
          {node.role ?? 'guest'}
        </span>
        {!isExpanded && hasVitals && (
          <div className="flex gap-1 flex-shrink-0">
            {node.vital_signs.map(vs => (
              <span
                key={vs.definition_id}
                title={`${vs.label}: ${isVitalRecorded(vs) ? 'recorded' : 'not recorded'}`}
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: isVitalRecorded(vs) ? 'var(--brand-crimson)' : 'rgba(0,0,0,0.12)' }}
              />
            ))}
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 pt-2 space-y-3" style={{ borderTop: '1px solid var(--border-default)' }}>
          {hasStats && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {node.gpv != null && <Stat label="ГТС" value={node.gpv.toLocaleString('de-DE', { maximumFractionDigits: 0 })} />}
              {node.ppv != null && <Stat label="ЛТС" value={node.ppv.toLocaleString('de-DE', { maximumFractionDigits: 0 })} />}
              {node.bonus_percent != null && <Stat label="Bonus %" value={`${node.bonus_percent}%`} />}
              {node.group_size != null && <Stat label="Group size" value={String(node.group_size)} />}
              {node.qualified_legs != null && <Stat label="Qualified legs" value={String(node.qualified_legs)} />}
              {node.annual_ppv != null && <Stat label="Annual PPV" value={node.annual_ppv.toLocaleString('de-DE', { maximumFractionDigits: 0 })} />}
              {node.renewal_date && <Stat label="Renewal date" value={formatDate(node.renewal_date)} />}
              {node.country && <Stat label="Country" value={node.country} />}
              {node.depth != null && <Stat label="Tree depth" value={String(node.depth)} />}
            </div>
          )}
          {hasVitals && (
            <div>
              <p className="text-[10px] font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>
                Vital Signs
              </p>
              <div className="flex flex-wrap gap-2">
                {node.vital_signs.map(vs => (
                  <span
                    key={vs.definition_id}
                    className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{
                      backgroundColor: isVitalRecorded(vs) ? 'rgba(188,71,73,0.12)' : 'rgba(0,0,0,0.05)',
                      color: isVitalRecorded(vs) ? 'var(--brand-crimson)' : 'var(--text-secondary)',
                    }}
                  >
                    {isVitalRecorded(vs) ? '✓' : '○'} {vs.label}
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

// ── Recursive tree node ───────────────────────────────────────────────────────

function TreeNode({ node, depth, expanded, onToggleExpand }: {
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
      <MemberCard node={node} isExpanded={isExpanded} onToggle={() => onToggleExpand(key)} />
      {hasChildren && (
        <div style={{ borderLeft: '2px solid var(--border-default)', marginLeft: 10, paddingLeft: 10 }}>
          {node.children!.map((child, ci) => (
            <TreeNode
              key={child.abo_number ?? child.profile_id ?? `child-${ci}`}
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

// ── Guest view helper ────────────────────────────────────────────────────────

function SimpleRow({ node, label }: { node: LOSNode; label: string }) {
  const rc = roleColors(node.role)
  return (
    <div>
      <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </p>
      <div
        className="rounded-xl px-4 py-3 flex items-center gap-3"
        style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${rc.border}` }}
      >
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{displayName(node)}</span>
        {node.abo_number && (
          <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{node.abo_number}</span>
        )}
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ml-auto"
          style={{ backgroundColor: rc.labelBg, color: rc.labelColor }}
        >
          {node.role ?? 'member'}
        </span>
      </div>
    </div>
  )
}

// ── Guest view ────────────────────────────────────────────────────────────────

function GuestView({ nodes, callerAbo }: { nodes: LOSNode[]; callerAbo: string | null }) {
  const self = nodes.find(n => n.abo_number === callerAbo) ?? nodes[0]
  const upline = nodes.find(n => n.abo_number !== callerAbo)

  return (
    <div className="space-y-4">
      {upline && <SimpleRow node={upline} label="Your Upline" />}
      {self && <SimpleRow node={self} label="You" />}
    </div>
  )
}

// ── Inner page (reads searchParams) ──────────────────────────────────────────

function LOSPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const view = (searchParams.get('view') ?? 'list') as 'list' | 'chart'
  const [chartDepth, setChartDepth] = useState(3)

  const { data, isLoading, isError } = useQuery<TreeResponse>({
    queryKey: ['los-tree'],
    queryFn: () => apiClient<TreeResponse>('/api/los/tree'),
    staleTime: 5 * 60 * 1000,
  })

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  function setView(v: 'list' | 'chart') {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', v)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

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

  const searchLower = search.toLowerCase().trim()
  const filteredTree: LOSNode[] = searchLower
    ? (data?.nodes ?? [])
        .filter(n => {
          const name = displayName(n).toLowerCase()
          return name.includes(searchLower) || (n.abo_number ?? '').includes(searchLower)
        })
        .map(n => ({ ...n, children: [] }))
    : tree

  const scopeLabel = data?.scope === 'full'
    ? 'Full Tree'
    : data?.scope === 'subtree'
    ? 'Your Network'
    : 'Your Upline'

  const isGuest = data?.scope === 'guest'

  return (
    <div className="py-8 pb-16">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 xl:px-8">

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
            {(['core', 'member', 'guest'] as const).map(role => {
              const rc = roleColors(role)
              return (
                <div key={role} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: rc.labelBg, border: `1px solid ${rc.border}`, opacity: rc.opacity }}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* View switcher — non-guest only */}
        {!isGuest && data && (
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            {(['list', 'chart'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                style={{
                  borderColor: view === v ? 'var(--text-primary)' : 'var(--border-default)',
                  backgroundColor: view === v ? 'var(--text-primary)' : 'transparent',
                  color: view === v ? 'var(--bg-global)' : 'var(--text-secondary)',
                }}
              >
                {v === 'list' ? 'List' : 'Chart'}
              </button>
            ))}

            {/* Depth control — chart view only */}
            {view === 'chart' && (
              <div className="flex items-center gap-2 ml-4">
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Depth:</span>
                {[1, 2, 3, 4, 5].map(d => (
                  <button
                    key={d}
                    onClick={() => setChartDepth(d)}
                    className="w-6 h-6 rounded text-xs font-semibold border transition-colors"
                    style={{
                      borderColor: chartDepth === d ? 'var(--text-primary)' : 'var(--border-default)',
                      backgroundColor: chartDepth === d ? 'var(--text-primary)' : 'transparent',
                      color: chartDepth === d ? 'var(--bg-global)' : 'var(--text-secondary)',
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search + expand controls — list view only */}
        {!isGuest && view === 'list' && (
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

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-10 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--border-default)' }} />
            ))}
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--brand-crimson)' }}>Failed to load LOS data.</p>
          </div>
        )}

        {/* Guest */}
        {!isLoading && !isError && isGuest && (
          <GuestView nodes={data!.nodes} callerAbo={data!.caller_abo} />
        )}

        {/* Chart */}
        {!isLoading && !isError && !isGuest && view === 'chart' && (
          <OrgChartCanvas roots={tree} maxDepth={chartDepth} />
        )}

        {/* List */}
        {!isLoading && !isError && !isGuest && view === 'list' && (
          <>
            {filteredTree.length === 0 && (
              <p className="text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>
                {searchLower ? 'No members match your search.' : 'No data available.'}
              </p>
            )}
            {filteredTree.map((node, ni) => (
              <TreeNode
                key={node.abo_number ?? node.profile_id ?? `node-${ni}`}
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

// ── Page — Suspense boundary for useSearchParams ──────────────────────────────

export default function LOSPage() {
  return (
    <Suspense>
      <LOSPageInner />
    </Suspense>
  )
}
