'use client'

import type { VerificationRequest } from './VerificationsTab'
import { useLanguage } from '@/lib/hooks/useLanguage'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

type Props = {
  items: VerificationRequest[]
  onApprove: (id: string) => void
  onDeny: (id: string) => void
  isPending: boolean
  showNoAboBadge: boolean
  emptyMessage: string
}

export function VerificationList({ items, onApprove, onDeny, isPending, showNoAboBadge, emptyMessage }: Props) {
  const { t } = useLanguage()

  if (items.length === 0) {
    return (
      <div className="rounded-xl border px-5 py-6 text-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {items.map(v => (
        <div key={v.id} className="rounded-xl border px-4 py-3.5 flex items-center gap-3" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {v.profiles?.first_name} {v.profiles?.last_name}
              </p>
              {showNoAboBadge && (
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: 'rgba(62,119,133,0.15)', color: '#3E7785' }}
                >
                  {t('admin.approval.verify.noAboBadge')}
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {v.claimed_abo ? `ABO ${v.claimed_abo} · ` : ''}Upline {v.claimed_upline_abo} · {formatDate(v.created_at)}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => onApprove(v.id)}
              disabled={isPending}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: 'var(--brand-teal)' }}
            >
              {t('admin.approval.verify.btn.approve')}
            </button>
            <button
              onClick={() => onDeny(v.id)}
              disabled={isPending}
              className="px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--text-primary)' }}
            >
              {t('admin.approval.verify.btn.deny')}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
