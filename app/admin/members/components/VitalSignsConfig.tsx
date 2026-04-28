'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/apiClient'
import type { VitalSignDefinition } from './los-admin-types'

// ── VitalSignsConfig ──────────────────────────────────────────────────────────
// Owns: toggle-active mutation, drag-reorder mutation, local optimistic state.
// Both mutations use apiClient — apiFetch is deleted.

export function VitalSignsConfig({ definitions, onRefetch }: {
  definitions: VitalSignDefinition[]
  onRefetch: () => void
}) {
  const qc = useQueryClient()
  const [dragging, setDragging] = useState<string | null>(null)
  const [localDefs, setLocalDefs] = useState<VitalSignDefinition[]>(() =>
    [...definitions].sort((a, b) => a.sort_order - b.sort_order)
  )

  // Sync localDefs when upstream definitions change (e.g. after invalidation)
  const defsKey = definitions.map(d => d.id + d.is_active + d.sort_order).join(',')
  const [prevKey, setPrevKey] = useState(defsKey)
  if (prevKey !== defsKey) {
    setPrevKey(defsKey)
    setLocalDefs([...definitions].sort((a, b) => a.sort_order - b.sort_order))
  }

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      apiClient(`/api/admin/vital-sign-definitions/${id}`, {
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
        apiClient(`/api/admin/vital-sign-definitions/${item.id}`, {
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
