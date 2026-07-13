'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/apiClient'
import { JunctionPanel } from '@/components/los-import/AssemblySummary'
import type { JunctionNode } from '@/lib/csv-import'

type Submitter = { first_name: string; last_name: string; abo_number: string | null }

export type LosSubmission = {
  id: string
  root_abo_number: string
  row_count: number
  status: 'pending' | 'approved' | 'rejected'
  admin_note: string | null
  created_at: string
  resolved_at: string | null
  profiles: Submitter | null
}

type ApproveResult = { inserted: number; import_id: string; approved: number; junctions: JunctionNode[]; conflicts: JunctionNode[]; row_count: number }

const STATUS_STYLE: Record<LosSubmission['status'], { bg: string; color: string; label: string }> = {
  pending:  { bg: '#f2cc8f33', color: '#7a5c00', label: 'Pending' },
  approved: { bg: '#1a3c2e18', color: '#1a3c2e', label: 'Approved' },
  rejected: { bg: '#bc474915', color: '#bc4749', label: 'Rejected' },
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fullName(p: Submitter | null) {
  if (!p) return '—'
  return `${p.first_name} ${p.last_name}`.trim()
}

export function LosSubmissionsTab() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ApproveResult | null>(null)

  const { data: submissions = [], isLoading } = useQuery<LosSubmission[]>({
    queryKey: ['los-submissions'],
    queryFn: async () => (await apiClient<{ submissions: LosSubmission[] }>('/api/admin/los-submission')).submissions,
  })

  const pending = submissions.filter(s => s.status === 'pending')

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function approve() {
    if (selected.size === 0) return
    setBusy(true); setError(null); setResult(null)
    try {
      const res = await apiClient<ApproveResult>('/api/admin/los-submission', {
        method: 'POST',
        body: JSON.stringify({ action: 'approve', ids: [...selected] }),
      })
      setResult(res)
      setSelected(new Set())
      qc.invalidateQueries({ queryKey: ['los-submissions'] })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Approve failed')
    } finally {
      setBusy(false)
    }
  }

  async function reject(id: string) {
    setBusy(true); setError(null)
    try {
      await apiClient('/api/admin/los-submission', { method: 'POST', body: JSON.stringify({ action: 'reject', id }) })
      qc.invalidateQueries({ queryKey: ['los-submissions'] })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reject failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>
        {pending.length} pending submission{pending.length !== 1 ? 's' : ''}
      </p>
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        Select CORE submissions to merge (deepest-owner-wins per ABO) and import in one authoritative step.
      </p>

      {error && <p className="text-sm" style={{ color: '#bc4749' }}>{error}</p>}

      {result && (
        <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-card)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Imported {result.inserted} rows from {result.approved} submission{result.approved !== 1 ? 's' : ''}.
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Import ID: <span className="font-mono">{result.import_id}</span></p>
          {result.conflicts.length > 0 && (
            <p className="text-xs mt-1" style={{ color: '#e07a5f' }}>{result.conflicts.length} contested node(s) — deepest owner won each.</p>
          )}
          <JunctionPanel junctions={result.junctions} ownerLabel="owners" />
        </div>
      )}

      {selected.size > 0 && (
        <button onClick={approve} disabled={busy} className="bg-[#bc4749] text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
          {busy ? 'Importing…' : `Approve & import (${selected.size} selected)`}
        </button>
      )}

      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-black/5 rounded-xl animate-pulse" />)}</div>
      ) : submissions.length === 0 ? (
        <div className="rounded-xl border px-5 py-8 text-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No submissions yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {submissions.map(sub => {
            const s = STATUS_STYLE[sub.status]
            const isPending = sub.status === 'pending'
            return (
              <div key={sub.id} className="rounded-xl border px-4 py-3.5" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                <div className="flex items-start gap-3">
                  {isPending && (
                    <input type="checkbox" checked={selected.has(sub.id)} onChange={() => toggle(sub.id)} className="mt-1" aria-label={`Select submission from ${fullName(sub.profiles)}`} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{fullName(sub.profiles)}</p>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      Root ABO <span className="font-mono">{sub.root_abo_number}</span> · {sub.row_count} members · {fmtDate(sub.created_at)}
                    </p>
                    {sub.admin_note && <p className="text-xs mt-1 italic" style={{ color: 'var(--text-secondary)' }}>Note: {sub.admin_note}</p>}
                  </div>
                  {isPending && (
                    <button onClick={() => reject(sub.id)} disabled={busy} className="text-xs px-3 py-1.5 rounded-lg border disabled:opacity-50" style={{ borderColor: '#bc4749', color: '#bc4749' }}>
                      Reject
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
