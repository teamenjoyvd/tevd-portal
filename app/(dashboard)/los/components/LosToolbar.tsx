'use client'

import type { LOSNode } from '../lib/los-utils'

// ── Props ─────────────────────────────────────────────────────────────────────

type LosToolbarProps = {
  isGuest: boolean
  view: 'list' | 'chart'
  setView: (v: 'list' | 'chart') => void
  chartDepth: number
  setChartDepth: (d: number) => void
  search: string
  setSearch: (s: string) => void
  expanded: Set<string>
  setExpanded: (s: Set<string>) => void
  tree: LOSNode[]
}

// ── Helpers (module scope) ────────────────────────────────────────────────────

function collectKeys(nodes: LOSNode[]): Set<string> {
  const keys = new Set<string>()
  function walk(n: LOSNode) {
    if (n.abo_number) keys.add(n.abo_number)
    else if (n.profile_id) keys.add(n.profile_id)
    for (const c of n.children ?? []) walk(c)
  }
  nodes.forEach(walk)
  return keys
}

// ── LosToolbar ────────────────────────────────────────────────────────────────

export function LosToolbar({
  isGuest, view, setView, chartDepth, setChartDepth,
  search, setSearch, expanded, setExpanded, tree,
}: LosToolbarProps) {
  if (isGuest) return null

  const searchLower = search.toLowerCase().trim()

  return (
    <>
      {/* View switcher */}
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

      {/* Search + expand controls — list view only */}
      {view === 'list' && (
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
                onClick={() => setExpanded(collectKeys(tree))}
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
    </>
  )
}
