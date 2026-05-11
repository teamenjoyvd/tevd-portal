'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '@/lib/hooks/useLanguage'

// ── Types ────────────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fullName(p: { first_name: string; last_name: string } | null) {
  if (!p) return '—'
  return `${p.first_name} ${p.last_name}`.trim()
}

const STATUS_STYLE: Record<SpouseLinkRequest['status'], { bg: string; color: string; label: string }> = {
  pending:  { bg: '#f2cc8f33', color: '#7a5c00', label: 'Pending primary review' },
  approved: { bg: '#1a3c2e18', color: '#1a3c2e', label: 'Approved' },
  denied:   { bg: '#bc474915', color: '#bc4749', label: 'Denied' },
}

// ── Component ────────────────────────────────────────────

export function SpouseLinkRequestsTab() {
  const { t } = useLanguage()
  const qc = useQueryClient()

  const { data: requests = [], isLoading } = useQuery<SpouseLinkRequest[]>({
    queryKey: ['spouse-link-requests'],
    queryFn: () => fetch('/api/admin/spouse-link-requests').then(async r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    }),
  })

  void qc // retained to avoid unused import warning; may be used for future refresh triggers

  const pending = requests.filter(r => r.status === 'pending')

  return (
    <div>
      <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>
        {t('admin.approval.spouse.pendingTitle').replace('{{count}}', String(pending.length))}
      </p>

      <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
        Spouse link requests are now reviewed by the primary member, not admin. This view is read-only.
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-black/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : requests.length === 0 ? (
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
          {requests.map(req => {
            const s = STATUS_STYLE[req.status]
            return (
              <div
                key={req.id}
                className="rounded-xl border px-4 py-3.5"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {fullName(req.requester)}
                      </p>
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: s.bg, color: s.color }}
                      >
                        {s.label}
                      </span>
                    </div>
                    {req.requester?.contact_email && (
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {req.requester.contact_email}
                      </p>
                    )}
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
                    {req.admin_note && (
                      <p className="text-xs mt-1 italic" style={{ color: 'var(--text-secondary)' }}>
                        Note: {req.admin_note}
                      </p>
                    )}
                    {req.resolved_at && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        Resolved: {formatDate(req.resolved_at)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
