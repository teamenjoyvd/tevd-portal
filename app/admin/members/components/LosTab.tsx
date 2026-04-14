'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getRoleColors } from '@/lib/role-colors'
import { formatDate } from '@/lib/format'

// ── Types ─────────────────────────────────────────────────────────────────────

type VitalSign = {
  definition_id: string
  label: string
  is_active: boolean
  recorded_at: string | null
  note: string | null
}

type VitalSignDefinition = {
  id: string
  category: string
  label: string | null
  is_active: boolean
  sort_order: number
}

type TreeNode = {
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

type LosTreeResponse = {
  scope: string
  nodes: TreeNode[]
  caller_abo: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildTree(nodes: TreeNode[]): TreeNode[] {
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

async function apiFetch(url: string, options: RequestInit): Promise<void> {
  const res = await fetch(url, options)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
}

// ── VitalSignsConfig ──────────────────────────────────────────────────────────

function VitalSignsConfig({ definitions, onRefetch }: {
  definitions: VitalSignDefinition[]
  onRefetch: () => void
}) {
  const qc = useQueryClient()
  const [dragging, setDragging] = useState<string | null>(null)
  const [localDefs, setLocalDefs] = useState<VitalSignDefinition[]>(() =>
    [...definitions].sort((a, b) => a.sort_order - b.sort_order)
  )

  const defsKey = definitions.map(d => d.id + d.is_active + d.sort_order).join(',')
  const prevKey = useRef(defsKey)
  if (prevKey.current !== defsKey) {
    prevKey.current = defsKey
    setLocalDefs([...definitions].sort((a, b) => a.sort_order - b.sort_order))
  }

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      apiFetch(`/api/admin/vital-sign-definitions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active }),
      }),
    onMutate: ({ id, is_active }) => {
      setLocalDefs(prev => prev.map(d => d.id === id ? { ...d, is_active } : d))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vital-sign-definitions'] })
      onRefetch()
    },
    onError: (_err, { id, is_active }) => {
      setLocalDefs(prev => prev.map(d => d.id === id ? { ...d, is_active: !is_active } : d))
    },
  })

  const reorderMutation = useMutation({
    mutationFn: (items: { id: string; sort_order: number }[]) =>
      Promise.all(items.map(item =>
        fetch(`/api/admin/vital-sign-definitions/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: item.sort_order }),
        })
      )),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vital-sign-definitions'] }),
  })

  function handleDragStart(id: string) { setDragging(id) }

  function handleDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault()
    if (!dragging || dragging === targetId) return
    setLocalDefs(prev => {
      const from = prev.findIndex(d => d.id === dragging)
      const to = prev.findIndex(d => d.id === targetId)
      if (from === -1 || to === -1) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  function handleDrop() {
    setDragging(null)
    const updates = localDefs.map((d, i) => ({ id: d.id, sort_order: i * 10 }))
    reorderMutation.mutate(updates)
  }

  return (
    <div className="rounded-xl p-4 mb-6"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      <p className="text-xs font-semibold uppercase tracking-widest mb-3"
        style={{ color: 'var(--brand-crimson)' }}>Vital Signs</p>
      <div className="space-y-1.5">
        {localDefs.map(def => (
          <div
            key={def.id}
            draggable
            onDragStart={() => handleDragStart(def.id)}
            onDragOver={e => handleDragOver(e, def.id)}
            onDrop={handleDrop}
            onDragEnd={() => setDragging(null)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg transition-opacity"
            style={{
              backgroundColor: dragging === def.id ? 'rgba(0,0,0,0.06)' : 'transparent',
              opacity: def.is_active ? 1 : 0.5,
              cursor: 'grab',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
              className="flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
              <circle cx="4" cy="3" r="1.2" fill="currentColor"/>
              <circle cx="4" cy="7" r="1.2" fill="currentColor"/>
              <circle cx="4" cy="11" r="1.2" fill="currentColor"/>
              <circle cx="10" cy="3" r="1.2" fill="currentColor"/>
              <circle cx="10" cy="7" r="1.2" fill="currentColor"/>
              <circle cx="10" cy="11" r="1.2" fill="currentColor"/>
            </svg>
            <span className="flex-1 text-sm font-body" style={{ color: 'var(--text-primary)' }}>
              {def.label ?? def.category}
            </span>
            <button
              disabled={toggleActiveMutation.isPending}
              onClick={() => toggleActiveMutation.mutate({ id: def.id, is_active: !def.is_active })}
              className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-all disabled:opacity-50"
              style={{
                backgroundColor: def.is_active ? 'rgba(26,107,74,0.12)' : 'rgba(0,0,0,0.06)',
                color: def.is_active ? '#1a6b4a' : 'var(--text-secondary)',
              }}
            >
              {def.is_active ? 'Active' : 'Inactive'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── NodeCard ──────────────────────────────────────────────────────────────────

function NodeCard({
  node, definitions, onToggle, isPending,
}: {
  node: TreeNode
  definitions: VitalSignDefinition[]
  onToggle: (profileId: string, definitionId: string, currentlyActive: boolean) => void
  isPending: boolean
}) {
  const [expanded, setExpanded] = useState(node.depth !== null ? node.depth < 2 : true)
  const rc = getRoleColors(node.role)
  const hasChildren = (node.children?.length ?? 0) > 0
  const displayName = node.first_name
    ? `${node.first_name} ${node.last_name}`
    : node.name ?? node.abo_number
  const vitalSigns = Array.isArray(node.vital_signs) ? node.vital_signs : []

  return (
    <div className="relative">
      <div className="rounded-xl p-4 mb-1"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-start gap-3">
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
      {hasChildren && expanded && (
        <div className="ml-6 pl-4 border-l" style={{ borderColor: 'var(--border-default)' }}>
          {node.children!.map(child => (
            <NodeCard key={child.abo_number} node={child} definitions={definitions}
              onToggle={onToggle} isPending={isPending} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── LosTab ────────────────────────────────────────────────────────────────────

export function LosTab() {
  const qc = useQueryClient()

  const { data: treeResponse, isLoading: treeLoading, refetch: refetchTree } = useQuery<LosTreeResponse>({
    queryKey: ['los-tree'],
    queryFn: () => fetch('/api/los/tree').then(r => r.json()),
  })

  const { data: definitionsRaw, refetch: refetchDefs } = useQuery<VitalSignDefinition[]>({
    queryKey: ['vital-sign-definitions'],
    queryFn: () => fetch('/api/admin/vital-sign-definitions').then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  })

  const flatNodes = treeResponse?.nodes ?? []
  const allDefinitions = Array.isArray(definitionsRaw) ? definitionsRaw : []
  const definitions = allDefinitions.filter(d => d.is_active)

  const activateMutation = useMutation({
    mutationFn: ({ profileId, definitionId }: { profileId: string; definitionId: string }) =>
      apiFetch(`/api/admin/members/${profileId}/vital-signs`, {
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
      apiFetch(`/api/admin/members/${profileId}/vital-signs/${definitionId}`, {
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

  function handleConfigRefetch() {
    refetchDefs()
    refetchTree()
  }

  const treeRoots = buildTree(flatNodes)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Full org tree with vital signs. Click a checkbox to toggle.
        </p>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{flatNodes.length} members</span>
      </div>
      {allDefinitions.length > 0 && (
        <VitalSignsConfig definitions={allDefinitions} onRefetch={handleConfigRefetch} />
      )}
      {treeLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--border-default)' }} />
          ))}
        </div>
      ) : treeRoots.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No LOS data yet.</p>
      ) : (
        <div className="space-y-1">
          {treeRoots.map(node => (
            <NodeCard key={node.abo_number} node={node} definitions={definitions}
              onToggle={handleToggle}
              isPending={isPending} />
          ))}
        </div>
      )}
    </div>
  )
}
