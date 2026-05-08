'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast'
import { useLanguage } from '@/lib/hooks/useLanguage'

// ── Types ────────────────────────────────────────────────────────

type Profile = { id: string; first_name: string; last_name: string; contact_email?: string; role?: string }
type ClaimedPrimary = { id: string; first_name: string; last_name: string; abo_number: string | null; role?: string }

export type SpouseLinkRequest = {
  id: string
  status: 'pending' | 'approved' | 'denied'
  admin_note: string | null
  created_at: string
  resolved_at: string | null
  requester: Profile | null
  claimed_primary: ClaimedPrimary | null
}

// ── Helpers ──────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fullName(p: { first_name: string; last_name: string } | null) {
  if (!p) return '—'
  return `${p.first_name} ${p.last_name}`.trim()
}

// ── Row: deny input state ────────────────────────────────────────
// Hoisted to module scope — avoids React remount anti-pattern.
function DenyForm({
  onCancel,
  onConfirm,
  isPending,
  t,
}: {
  onCancel: () => void
  onConfirm: (note: string) => void
  isPending: boolean
  t: (key: Parameters<ReturnType<typeof useLanguage>['t']>[0]) => string
}) {
  const [note, setNote] = useState('')
  return (
    <div className="mt-2 space-y-2">
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder={t('admin.approval.spouse.denyNotePlaceholder')}
        rows={2}
        className="w-full text-xs rounded-lg border px-3 py-2 resize-none focus:outline-none"
        style={{
          backgroundColor: 'var(--bg-global)',
          borderColor: 'var(--border-default)',
          color: 'var(--text-primary)',
        }}
      />
      <div className="flex gap-2">
        <button
          onClick={() => { if (note.trim()) onConfirm(note.trim()) }}
          disabled={!note.trim() || isPending}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-40 transition-opacity"
          style={{ backgroundColor: 'var(--brand-crimson)' }}
        >
          {t('admin.approval.spouse.btn.confirmDeny')}
        </button>
        <button
          onClick={onCancel}
          disabled={isPending}
          className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40 transition-opacity"
          style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--text-secondary)' }}
        >
          {t('admin.approval.spouse.btn.cancel')}
        </button>
      </div>
    </div>
  )
}

// ── Component ────────────────────────────────────────────────────

export function SpouseLinkRequestsTab() {
  const { t } = useLanguage()
  const qc = useQueryClient()
  const [denyingId, setDenyingId] = useState<string | null>(null)

  const { data: requests = [], isLoading } = useQuery<SpouseLinkRequest[]>({
    queryKey: ['spouse-link-requests'],
    queryFn: () => fetch('/api/admin/spouse-link-requests').then(r => r.json()),
  })

  const actionMutation = useMutation({
    mutationFn: ({ id, status, admin_note }: { id: string; status: 'approved' | 'denied'; admin_note?: string }) =>
      fetch(`/api/admin/spouse-link-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_note }),
      }).then(async r => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`)
        return body
      }),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: ['spouse-link-requests'] })
      const prev = qc.getQueryData<SpouseLinkRequest[]>(['spouse-link-requests'])
      // Optimistic: remove the row from pending view immediately
      qc.setQueryData<SpouseLinkRequest[]>(['spouse-link-requests'],
        old => old?.filter(r => r.id !== id)
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['spouse-link-requests'], ctx.prev)
      toast.error('Action failed. Please try again.')
    },
    onSuccess: (_data, vars) => {
      setDenyingId(null)
      const msg = vars.status === 'approved' ? 'Request approved.' : 'Request denied.'
      toast.success(msg)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['spouse-link-requests'] })
    },
  })

  const pending = requests.filter(r => r.status === 'pending')

  return (
    <div>
      <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>
        {t('admin.approval.spouse.pendingTitle').replace('{{count}}', String(pending.length))}
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-black/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : pending.length === 0 ? (
        <div
          className="rounded-xl border px-5 py-8 text-center"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
        >
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('admin.approval.spouse.noPending')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {pending.map(req => (
            <div
              key={req.id}
              className="rounded-xl border px-4 py-3.5"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {fullName(req.requester)}
                    {req.requester?.contact_email && (
                      <span className="font-normal text-xs ml-1.5" style={{ color: 'var(--text-secondary)' }}>
                        {req.requester.contact_email}
                      </span>
                    )}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {t('admin.approval.spouse.claimedPrimary')}:{' '}
                    <span style={{ color: 'var(--text-primary)' }}>
                      {fullName(req.claimed_primary)}
                      {req.claimed_primary?.abo_number && ` · ABO ${req.claimed_primary.abo_number}`}
                    </span>
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {t('admin.approval.spouse.submitted')}: {formatDate(req.created_at)}
                  </p>
                </div>

                {denyingId !== req.id && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => actionMutation.mutate({ id: req.id, status: 'approved' })}
                      disabled={actionMutation.isPending}
                      className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-opacity"
                      style={{ backgroundColor: 'var(--brand-teal)' }}
                    >
                      {t('admin.approval.spouse.btn.approve')}
                    </button>
                    <button
                      onClick={() => setDenyingId(req.id)}
                      disabled={actionMutation.isPending}
                      className="px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-opacity"
                      style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--text-primary)' }}
                    >
                      {t('admin.approval.spouse.btn.deny')}
                    </button>
                  </div>
                )}
              </div>

              {denyingId === req.id && (
                <DenyForm
                  onCancel={() => setDenyingId(null)}
                  onConfirm={note => actionMutation.mutate({ id: req.id, status: 'denied', admin_note: note })}
                  isPending={actionMutation.isPending}
                  t={t}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
