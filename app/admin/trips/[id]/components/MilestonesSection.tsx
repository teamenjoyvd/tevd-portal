'use client'

import { useState } from 'react'
import type { Milestone } from '@/lib/types/trips'
import { formatDate } from '@/lib/format'

export function MilestonesSection({
  tripId,
  initialMilestones,
}: {
  tripId: string
  initialMilestones: Milestone[]
}) {
  const [milestones, setMilestones] = useState<Milestone[]>(initialMilestones)
  const [draft, setDraft] = useState({ label: '', amount: '', due_date: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(next: Milestone[]) {
    setSaving(true)
    setError(null)
    try {
      const r = await fetch(`/api/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestones: next }),
      })
      if (!r.ok) throw new Error((await r.json()).error)
      setMilestones(next)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  function addMilestone() {
    if (!draft.label || !draft.amount || !draft.due_date) return
    const next = [...milestones, { label: draft.label, amount: Number(draft.amount), due_date: draft.due_date }]
    setDraft({ label: '', amount: '', due_date: '' })
    void save(next)
  }

  function removeMilestone(index: number) {
    void save(milestones.filter((_, i) => i !== index))
  }

  const inputCls = 'border rounded-xl px-3 py-2 text-sm w-full'
  const inputStyle = { borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }

  return (
    <section
      className="rounded-2xl p-5 space-y-4"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
    >
      <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Milestones</h2>

      {milestones.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No milestones yet.</p>
      ) : (
        <ul className="space-y-2">
          {milestones.map((m, i) => (
            <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg"
              style={{ backgroundColor: 'var(--bg-global)', border: '1px solid var(--border-default)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{m.label}</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  €{m.amount} · {formatDate(m.due_date)}
                </p>
              </div>
              <button
                onClick={() => removeMilestone(i)}
                disabled={saving}
                className="text-xs hover:opacity-70 transition-opacity disabled:opacity-40"
                style={{ color: 'var(--brand-crimson)' }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-3 gap-2">
        <input placeholder="Label" className={inputCls} style={inputStyle}
          value={draft.label} onChange={e => setDraft(p => ({ ...p, label: e.target.value }))} />
        <input type="number" placeholder="Amount" className={inputCls} style={inputStyle}
          value={draft.amount} onChange={e => setDraft(p => ({ ...p, amount: e.target.value }))} />
        <input type="date" className={inputCls} style={inputStyle}
          value={draft.due_date} onChange={e => setDraft(p => ({ ...p, due_date: e.target.value }))} />
      </div>

      {error && <p className="text-xs" style={{ color: 'var(--brand-crimson)' }}>{error}</p>}

      <button
        onClick={addMilestone}
        disabled={saving || !draft.label || !draft.amount || !draft.due_date}
        className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-40"
        style={{ backgroundColor: 'var(--brand-crimson)' }}
      >
        {saving ? 'Saving…' : 'Add milestone'}
      </button>
    </section>
  )
}
