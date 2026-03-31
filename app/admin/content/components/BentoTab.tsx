'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useBentoConfig, type BentoConfigEntry } from '@/lib/hooks/useBentoConfig'

const TILE_LABELS: Record<string, string> = {
  events:        'Events tile',
  trips:         'Trips tile',
  announcements: 'Announcements tile',
  howtos:        'Howtos tile',
  links:         'Links & Guides tile',
}

export function BentoTab() {
  const qc = useQueryClient()
  const { data: config = [], isLoading } = useBentoConfig()
  const [draft, setDraft] = useState<Record<string, number>>({})
  const [saved, setSaved] = useState(false)

  const values: Record<string, number> = {}
  config.forEach(e => { values[e.tile_key] = draft[e.tile_key] ?? e.max_items })

  const saveMutation = useMutation({
    mutationFn: (updates: BentoConfigEntry[]) =>
      fetch('/api/admin/bento-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bento-config'] })
      setDraft({})
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  function handleSave() {
    const updates = Object.entries(draft).map(([tile_key, max_items]) => ({ tile_key, max_items }))
    if (updates.length > 0) saveMutation.mutate(updates)
  }

  const isDirty = Object.keys(draft).length > 0

  return (
    <section>
      <div className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
        <p className="text-xs mb-5" style={{ color: 'var(--text-secondary)' }}>
          Maximum number of items shown per tile on the homepage.
        </p>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--border-default)' }} />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {config.map(entry => (
              <div key={entry.tile_key} className="flex items-center justify-between gap-4">
                <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {TILE_LABELS[entry.tile_key] ?? entry.tile_key}
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={values[entry.tile_key] ?? entry.max_items}
                  onChange={e => setDraft(d => ({ ...d, [entry.tile_key]: Number(e.target.value) }))}
                  className="w-20 border rounded-xl px-3 py-2 text-sm text-center"
                  style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
                />
              </div>
            ))}
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={!isDirty || saveMutation.isPending}
          className="mt-5 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--brand-crimson)' }}
        >
          {saveMutation.isPending ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>
    </section>
  )
}
