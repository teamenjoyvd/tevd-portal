'use client'

import { formatDate, formatCurrency } from '@/lib/format'
import { useLanguage } from '@/lib/hooks/useLanguage'
import type { Payment } from '@/lib/types/payments'
import { PaymentGroupCard } from './PaymentGroupCard'

/**
 * Bucket the queue into on-behalf groups and legacy singles, preserving the
 * original order (2607-DEV-676). The key is `payment_group_id` or, for a single,
 * a `single:` prefix that cannot collide with a uuid — so one loop renders both
 * without a second pass or a sort.
 */
type Bucket =
  | { kind: 'single'; key: string; payment: Payment }
  | { kind: 'group'; key: string; groupId: string; rows: Payment[] }

function bucketize(payments: Payment[]): Bucket[] {
  const buckets: Bucket[] = []
  const groupIndex = new Map<string, number>()

  for (const p of payments) {
    const groupId = p.payment_group_id
    if (!groupId) {
      buckets.push({ kind: 'single', key: `single:${p.id}`, payment: p })
      continue
    }
    const at = groupIndex.get(groupId)
    if (at === undefined) {
      groupIndex.set(groupId, buckets.length)
      buckets.push({ kind: 'group', key: groupId, groupId, rows: [p] })
    } else {
      const bucket = buckets[at]
      if (bucket.kind === 'group') bucket.rows.push(p)
    }
  }
  return buckets
}

export function PendingPaymentsSection({
  payments,
  reviewNotes,
  setReviewNotes,
  onApprove,
  onReject,
  onApproveGroup,
  onRejectGroup,
  isPending,
}: {
  payments: Payment[]
  reviewNotes: Record<string, string>
  setReviewNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>
  onApprove: (id: string, note: string | null) => void
  onReject: (id: string, note: string | null) => void
  onApproveGroup: (groupId: string, note: string | null) => void
  onRejectGroup: (groupId: string, note: string) => void
  isPending: boolean
}) {
  const { t } = useLanguage()

  if (payments.length === 0) return null

  return (
    <div>
      <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>
        {t('admin.operations.payments.pendingTitle').replace('{{count}}', String(payments.length))}
      </p>
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
        {bucketize(payments).map((bucket, i) => bucket.kind === 'group' ? (
          <div key={bucket.key}
            style={{ borderTop: i > 0 ? '1px solid var(--border-default)' : 'none' }}>
            <PaymentGroupCard
              groupId={bucket.groupId}
              rows={bucket.rows}
              note={reviewNotes[bucket.groupId] ?? ''}
              setNote={value => setReviewNotes(n => ({ ...n, [bucket.groupId]: value }))}
              onApprove={onApproveGroup}
              onReject={onRejectGroup}
              isPending={isPending}
            />
          </div>
        ) : (
          <div key={bucket.key}
            style={{ borderTop: i > 0 ? '1px solid var(--border-default)' : 'none' }}>
            <PendingSingleRow
              p={bucket.payment}
              reviewNotes={reviewNotes}
              setReviewNotes={setReviewNotes}
              onApprove={onApprove}
              onReject={onReject}
              isPending={isPending}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * A legacy, non-grouped pending payment. Markup lifted verbatim out of the map
 * so the single-row queue renders exactly as it did before groups existed.
 */
function PendingSingleRow({
  p, reviewNotes, setReviewNotes, onApprove, onReject, isPending,
}: {
  p: Payment
  reviewNotes: Record<string, string>
  setReviewNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>
  onApprove: (id: string, note: string | null) => void
  onReject: (id: string, note: string | null) => void
  isPending: boolean
}) {
  const { t } = useLanguage()

  // An absent note and an empty note both mean "no admin note" — collapse both
  // to null explicitly rather than truthiness-checking a string that can be ''.
  function noteFor(id: string): string | null {
    const note = reviewNotes[id]
    return note === undefined || note === '' ? null : note
  }

  return (
          <div className="px-5 py-4 space-y-3">
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
                {p.proof_url && (
                  <a
                    href={`/api/admin/payments/${p.id}/proof`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs hover:underline"
                    style={{ color: 'var(--brand-teal)' }}
                  >
                    {t('admin.operations.payments.viewProof')}
                  </a>
                )}
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#f2cc8f33', color: '#7a5c00' }}>
                {t('admin.operations.payments.badge.pending')}
              </span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <input
                value={reviewNotes[p.id] ?? ''}
                onChange={e => setReviewNotes(n => ({ ...n, [p.id]: e.target.value }))}
                placeholder={t('admin.operations.payments.placeholder.adminNote')}
                className="flex-1 border rounded-xl px-3 py-2 text-xs"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
              />
              {/* Own row under sm so the two buttons split the width instead of
                  stretching vertically inside the stacked column. */}
              <div className="flex gap-2 sm:contents">
                <button
                  onClick={() => onApprove(p.id, noteFor(p.id))}
                  disabled={isPending}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity sm:flex-shrink-0"
                  style={{ backgroundColor: '#2d6a4f' }}
                >{t('admin.operations.payments.btn.approve')}</button>
                <button
                  onClick={() => onReject(p.id, noteFor(p.id))}
                  disabled={isPending}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity sm:flex-shrink-0"
                  style={{ backgroundColor: 'var(--brand-crimson)' }}
                >{t('admin.operations.payments.btn.deny')}</button>
              </div>
            </div>
          </div>
  )
}
