'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getRoleColors } from '@/lib/role-colors'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { formatDate } from '@/lib/format'
import { apiClient } from '@/lib/apiClient'
import { VitalSignsConfig } from './VitalSignsConfig'
import { buildTree } from './los-admin-types'
import type { TreeNode, LosTreeResponse, VitalSignDefinition } from './los-admin-types'

// ── Search helpers ───────────────────────────────────────────────────────────

// Returns the set of abo_numbers that match the query (case-insensitive).
// A node matches if its display name or abo_number contains the term.
function getMatchingAboNumbers(nodes: TreeNode[], term: string): Set<string> {
  const lower = term.toLowerCase()
  const matched = new Set<string>()
  for (const n of nodes) {
    const displayName = n.first_name
      ? `${n.first_name} ${n.last_name ?? ''}`.toLowerCase()
      : (n.name ?? '').toLowerCase()
    if (displayName.includes(lower) || n.abo_number.toLowerCase().includes(lower)) {
      matched.add(n.abo_number)
    }
  }
  return matched
}

// Walk flat nodes to collect ancestor abo_numbers for all matched nodes.
// Preserves tree context so the tree remains navigable during search.
function getAncestors(nodes: TreeNode[], matchedAboNumbers: Set<string>): Set<string> {
  const parentMap = new Map<string, string | null>()
  for (const n of nodes) parentMap.set(n.abo_number, n.sponsor_abo_number ?? null)

  const ancestors = new Set<string>()
  for (const abo of matchedAboNumbers) {
    let current = parentMap.get(abo) ?? null
    while (current) {
      if (ancestors.has(current)) break // already traced this chain
      ancestors.add(current)
      current = parentMap.get(current) ?? null
    }
  }
  return ancestors
}

// Filter a tree so only matched nodes and their ancestors survive.
// Children of ancestor-only nodes are pruned unless they are also matched/ancestors.
function filterTree(roots: TreeNode[], visible: Set<string>): TreeNode[] {
  function filterNode(node: TreeNode): TreeNode | null {
    if (!visible.has(node.abo_number)) return null
    const filteredChildren = (node.children ?? []).map(filterNode).filter((c): c is TreeNode => c !== null)
    return { ...node, children: filteredChildren }
  }
  return roots.map(filterNode).filter((n): n is TreeNode => n !== null)
}

// ── NodeCard ──────────────────────────────────────────────────────────────────────────────
// Recursive — stays at module scope in LosTab.tsx (self-referential, single consumer).

function NodeCard({
  node, definitions, onToggle, isPending, expanded, onToggleExpand, isSearchActive, matchedAboNumbers,
}: {
  node: TreeNode
  definitions: VitalSignDefinition[]
  onToggle: (profileId: string, definitionId: string, currentlyActive: boolean) => void
  isPending: boolean
  expanded: Set<string>
  onToggleExpand: (key: string) => void
  isSearchActive: boolean
  matchedAboNumbers: Set<string>
}) {
  const key = node.abo_number
  const isExpanded = expanded.has(key)
  const rc = getRoleColors(node.role)
  const hasChildren = (node.children?.length ?? 0) > 0
  const displayName = node.first_name
    ? `${node.first_name} ${node.last_name}`
    : node.name ?? node.abo_number
  const vitalSigns = Array.isArray(node.vital_signs) ? node.vital_signs : []
  const isMatch = isSearchActive && matchedAboNumbers.has(node.abo_number)

  return (
    <div className="relative">
      <div
        className="rounded-xl p-4 mb-1"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: isMatch
            ? '1px solid var(--brand-teal)'
            : '1px solid var(--border-default)',
        }}
      >
        <div className="flex items-start gap-3">
          {hasChildren ? (
            <button onClick={() => onToggleExpand(key)}
              className="w-5 h-5 flex items-center justify-center rounded flex-shrink-0 mt-0.5 transition-colors hover:bg-black/10"
              style={{ color: 'var(--text-secondary)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          ) : <div className="w-5 flex-shrink-0" />}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-body text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{displayName}</span>
              <span className="font-body text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: rc.bg, color: rc.font }}>{node.role}</span>
              {node.abo_level && (
                <span className="font-body text-[10px]" style={{ color: 'var(--text-secondary)' }}>{node.abo_level}</span>
              )}
              <span className="font-body text-[10px]" style={{ color: 'var(--text-secondary)' }}>#{node.abo_number}</span>
            </div>
            {definitions.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-2">
                {definitions.map(def => {
                  const record = vitalSigns.find(v => v.definition_id === def.id)
                  const isActive = record?.is_active ?? false
                  const hasRecord = !!record
                  const noProfile = !node.profile_id
                  return (
                    <label key={def.id}
                      className={`flex items-center gap-1.5 ${
                        noProfile ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer group'
                      }`}
                      title={noProfile ? 'No portal account — cannot track vital signs' : undefined}>
                      <input
                        type="checkbox"
                        checked={isActive}
                        disabled={isPending || noProfile}
                        onChange={() => onToggle(node.profile_id!, def.id, isActive)}
                        className="w-3.5 h-3.5 rounded accent-[var(--brand-crimson)]"
                      />
                      <span
                        className="text-[11px] font-body transition-colors"
                        style={{
                          color: isActive ? 'var(--brand-crimson)' : 'var(--text-secondary)',
                          textDecoration: isActive ? 'underline' : 'none',
                          opacity: hasRecord && !isActive ? 0.5 : 1,
                        }}
                      >
                        {def.label ?? def.category}
                      </span>
                      {isActive && record?.recorded_at && (
                        <span className="text-[10px] font-body" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
                          {formatDate(record.recorded_at)}
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            )}
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
            D{node.depth ?? '?'}
          </span>
        </div>
      </div>
      {hasChildren && isExpanded && (
        <div className="ml-6 pl-4 border-l" style={{ borderColor: 'var(--border-default)' }}>
          {node.children!.map(child => (
            <NodeCard key={child.abo_number} node={child} definitions={definitions}
              onToggle={onToggle} isPending={isPending}
              expanded={expanded} onToggleExpand={onToggleExpand}
              isSearchActive={isSearchActive} matchedAboNumbers={matchedAboNumbers} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── LosTab ────────────────────────────────────────────────────────────────────────────

export function LosTab() {
  const { t } = useLanguage()
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const expandedInitialised = useRef(false)
  const [searchTerm, setSearchTerm] = useState('')

  const { data: treeResponse, isLoading: treeLoading, refetch: refetchTree } = useQuery<LosTreeResponse>({
    queryKey: ['los-tree'],
    queryFn: () => apiClient('/api/los/tree'),
  })

  const { data: definitionsRaw, refetch: refetchDefs } = useQuery<VitalSignDefinition[]>({
    queryKey: ['vital-sign-definitions'],
    queryFn: () => apiClient('/api/admin/vital-sign-definitions'),
    staleTime: 5 * 60 * 1000,
  })

  // Initialise expand state: all nodes at depth < 2 pre-expanded.
  // Runs exactly once on first data arrival.
  useEffect(() => {
    if (!treeResponse?.nodes) return
    if (expandedInitialised.current) return
    expandedInitialised.current = true
    const keys = new Set<string>()
    for (const n of treeResponse.nodes) {
      if (n.depth !== null && n.depth < 2) keys.add(n.abo_number)
    }
    setExpanded(keys)
  }, [treeResponse])

  const flatNodes = treeResponse?.nodes ?? []
  const allDefinitions = Array.isArray(definitionsRaw) ? definitionsRaw : []
  const definitions = allDefinitions.filter(d => d.is_active)

  const treeRoots = useMemo(() => buildTree(flatNodes), [flatNodes])

  // ── Search-filtered tree ────────────────────────────────────────────────
  const isSearchActive = searchTerm.trim().length > 0

  const { visibleRoots, matchedAboNumbers, visibleAboNumbers } = useMemo(() => {
    if (!isSearchActive) return { visibleRoots: treeRoots, matchedAboNumbers: new Set<string>(), visibleAboNumbers: new Set<string>() }
    const matched = getMatchingAboNumbers(flatNodes, searchTerm.trim())
    const ancestors = getAncestors(flatNodes, matched)
    const visible = new Set([...matched, ...ancestors])
    return {
      visibleRoots: filterTree(treeRoots, visible),
      matchedAboNumbers: matched,
      visibleAboNumbers: visible,
    }
  }, [isSearchActive, searchTerm, flatNodes, treeRoots])

  // Expand all visible nodes (matched + ancestors) whenever the search result set changes.
  useEffect(() => {
    if (isSearchActive) setExpanded(visibleAboNumbers)
  }, [isSearchActive, visibleAboNumbers])

  const activateMutation = useMutation({
    mutationFn: ({ profileId, definitionId }: { profileId: string; definitionId: string }) =>
      apiClient(`/api/admin/members/${profileId}/vital-signs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ definition_id: definitionId }),
      }),
    onMutate: ({ profileId, definitionId }) => {
      qc.setQueryData<LosTreeResponse>(['los-tree'], old => {
        if (!old) return old
        return {
          ...old,
          nodes: old.nodes.map(n =>
            n.profile_id !== profileId ? n : {
              ...n,
              vital_signs: n.vital_signs.map(v =>
                v.definition_id !== definitionId ? v : { ...v, is_active: true }
              ),
            }
          ),
        }
      })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['los-tree'] }),
  })

  const deactivateMutation = useMutation({
    mutationFn: ({ profileId, definitionId }: { profileId: string; definitionId: string }) =>
      apiClient(`/api/admin/members/${profileId}/vital-signs/${definitionId}`, {
        method: 'PATCH',
      }),
    onMutate: ({ profileId, definitionId }) => {
      qc.setQueryData<LosTreeResponse>(['los-tree'], old => {
        if (!old) return old
        return {
          ...old,
          nodes: old.nodes.map(n =>
            n.profile_id !== profileId ? n : {
              ...n,
              vital_signs: n.vital_signs.map(v =>
                v.definition_id !== definitionId ? v : { ...v, is_active: false }
              ),
            }
          ),
        }
      })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['los-tree'] }),
  })

  const isPending = activateMutation.isPending || deactivateMutation.isPending

  function handleToggle(profileId: string, definitionId: string, currentlyActive: boolean) {
    if (currentlyActive) deactivateMutation.mutate({ profileId, definitionId })
    else activateMutation.mutate({ profileId, definitionId })
  }

  function handleToggleExpand(key: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function handleConfigRefetch() {
    refetchDefs()
    refetchTree()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('admin.los.treeDesc')}</p>
        <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>{flatNodes.length} members</span>
      </div>

      {/* Search input */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ color: 'var(--text-secondary)' }}
        >
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search by name or ABO#…"
          className="w-full pl-9 pr-4 py-2 rounded-xl text-sm border"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-default)',
            color: 'var(--text-primary)',
          }}
        />
        {isSearchActive && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
            style={{ color: 'var(--text-secondary)' }}
          >
            Clear
          </button>
        )}
      </div>

      {isSearchActive && (
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {matchedAboNumbers.size} result{matchedAboNumbers.size !== 1 ? 's' : ''}
        </p>
      )}

      {allDefinitions.length > 0 && (
        <VitalSignsConfig definitions={allDefinitions} onRefetch={handleConfigRefetch} />
      )}

      {treeLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--border-default)' }} />
          ))}
        </div>
      ) : visibleRoots.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {isSearchActive ? 'No members match your search.' : t('admin.los.noData')}
        </p>
      ) : (
        <div className="space-y-1">
          {visibleRoots.map(node => (
            <NodeCard key={node.abo_number} node={node} definitions={definitions}
              onToggle={handleToggle} isPending={isPending}
              expanded={expanded} onToggleExpand={handleToggleExpand}
              isSearchActive={isSearchActive}
              matchedAboNumbers={matchedAboNumbers} />
          ))}
        </div>
      )}
    </div>
  )
}
