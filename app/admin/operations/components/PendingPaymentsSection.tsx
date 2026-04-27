'use client'

import { formatDate, formatCurrency } from '@/lib/format'
import { t } from '@/lib/i18n'

type Payment = {
  id: string
  amount: number
  currency: string
  transaction_date: string
  admin_status: string
  member_status: string
  payment_method: string | null
  proof_url: string | null
  note: string | null
  admin_note: string | null
  logged_by_admin: string | null
  created_at: string
  profiles: { first_name: string; last_name: string; abo_number: string | null } | null
  trips: { title: string; destination: string } | null
  payable_items: { title: string; item_type: string; currency: string } | null
}

export function PendingPaymentsSection({
  payments,
  reviewNotes,
  setReviewNotes,
  onApprove,
  onReject,
  isPending,
}: {
  payments: Payment[]
  reviewNotes: Record<string, string>
  setReviewNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>
  onApprove: (id: string, note: string | null) => void
  onReject: (id: string, note: string | null) => void
  isPending: boolean
}) {
  if (payments.length === 0) return null

  return (
    <div>
      <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>
        {t('admin.operations.payments.pendingTitle', 'en').replace('{{count}}', String(payments.length))}
      </p>
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
        {payments.map((p, i) => (
          <div key={p.id} className="px-5 py-4 space-y-3"
            style={{ borderTop: i > 0 ? '1px solid var(--border-default)' : 'none' }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {p.profiles?.first_name} {p.profiles?.last_name}
                  {p.profiles?.abo_number && <span className="font-mono font-normal ml-2 text-xs opacity-60">{p.profiles.abo_number}</span>}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {p.trips?.title ?? p.payable_items?.title ?? '—'}
                  {' · '}{formatDate(p.transaction_date)}
                  {' · '}{formatCurrency(p.amount, p.currency)}
                  {p.payment_method && ` · ${p.payment_method}`}
                </p>
                {p.note && <p className="text-xs mt-0.5 italic" style={{ color: 'var(--text-secondary)' }}>{p.note}</p>}
                {p.proof_url && <a href={p.proof_url} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: 'var(--brand-teal)' }}>{t('admin.operations.payments.viewProof', 'en')}</a>}
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#f2cc8f33', color: '#7a5c00' }}>
                {t('admin.operations.payments.badge.pending', 'en')}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                value={reviewNotes[p.id] ?? ''}
                onChange={e => setReviewNotes(n => ({ ...n, [p.id]: e.target.value }))}
                placeholder={t('admin.operations.payments.placeholder.adminNote', 'en')}
                className="flex-1 border rounded-xl px-3 py-2 text-xs"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
              />
              <button
                onClick={() => onApprove(p.id, reviewNotes[p.id] || null)}
                disabled={isPending}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
                style={{ backgroundColor: '#2d6a4f' }}
              >{t('admin.operations.payments.btn.approve', 'en')}</button>
              <button
                onClick={() => onReject(p.id, reviewNotes[p.id] || null)}
                disabled={isPending}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
                style={{ backgroundColor: 'var(--brand-crimson)' }}
              >{t('admin.operations.payments.btn.deny', 'en')}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
