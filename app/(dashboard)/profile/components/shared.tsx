'use client'

// ── Shared JSX sub-components used across profile section files ──────────────
// Kept separate from types.ts because .ts files cannot contain JSX.

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { formatDate, formatCurrency } from '@/lib/format'
import { beneficiaryNames, payerName, type LedgerEntry } from '@/lib/payments/ledger'
import { type TripEntry } from '../types'
import { StatusBadge } from './StatusBadge'

export function ShowMoreButton({ count, onClick }: { count: number; onClick: () => void }) {
  const { t } = useLanguage()
  return (
    <button
      onClick={onClick}
      className="mt-3 text-xs font-semibold hover:opacity-70 transition-opacity"
      style={{ color: 'var(--brand-crimson)' }}
    >
      +{count} {t('home.shared.showMore')}
    </button>
  )
}

export function TripRow({
  entry,
  onCancel,
  cancelPending,
}: {
  entry: TripEntry
  onCancel: (tripId: string) => void
  cancelPending: boolean
}) {
  const { t } = useLanguage()
  if (!entry.trip) return null
  const isCancelled = !!entry.cancelled_at
  const regStatus = isCancelled ? 'cancelled' : entry.registration_status
  return (
    <div
      className="rounded-xl p-3"
      style={{ backgroundColor: 'var(--bg-global)', border: '1px solid var(--border-default)', opacity: isCancelled ? 0.7 : 1 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{entry.trip.title}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{entry.trip.destination}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {formatDate(entry.trip.start_date)} – {formatDate(entry.trip.end_date)}
          </p>
        </div>
        <StatusBadge status={regStatus} className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0">
          {isCancelled ? t('home.shared.cancelled') : entry.registration_status}
        </StatusBadge>
      </div>
      {!isCancelled && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              disabled={cancelPending}
              className="mt-2 text-[11px] font-medium hover:opacity-70 transition-opacity disabled:opacity-40"
              style={{ color: 'var(--brand-crimson)' }}
            >
              {t('home.shared.cancelPart')}
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('home.shared.cancelPart')}</AlertDialogTitle>
              <AlertDialogDescription>{t('home.shared.cancelConfirm')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('profile.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={() => onCancel(entry.trip!.id)}>
                {t('home.shared.cancelPart')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}

/**
 * One line of the payments bento (2608-DEV-688).
 *
 * Takes a `LedgerEntry`, not a raw row: an on-behalf group is ONE bank transfer
 * and must render as one line whether or not an admin has approved it yet. The
 * previous version took a row and lost every trace of who a payment was for the
 * moment the group left `pending`.
 *
 * Two lines rather than one: attribution ("for Ana, Nadia (guest)") plus the
 * item title does not fit beside amount/date/status at 390px, and truncating
 * the names away would reinstate exactly the gap this issue closes.
 */
export function PaymentRow({
  entry,
  me,
  cancelledTripIds,
}: {
  entry: LedgerEntry
  me: string
  cancelledTripIds: Set<string>
}) {
  const { t } = useLanguage()
  const head = entry.rows[0]
  // Unchanged from the row-based version, including its known defect: a real
  // trip payment has payable_items === null, so this is always false. Out of
  // scope for 2608-DEV-688 and left as found.
  const linkedTripCancelled = head.payable_items?.item_type === 'trip' && cancelledTripIds.size > 0

  const forNames = beneficiaryNames(entry, me, t('payment.guestTag'))
  const paidBy = payerName(entry, me)
  const detail = entry.title || null

  return (
    <div className="text-xs rounded-xl px-3 py-2" style={{ backgroundColor: 'var(--bg-global)' }}>
      <div className="flex items-center gap-2">
        <span className="font-semibold flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
          {formatCurrency(entry.amount, entry.currency)}
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>{formatDate(entry.transaction_date)}</span>
        {entry.payment_method && <span className="truncate min-w-0" style={{ color: 'var(--text-secondary)' }}>{entry.payment_method}</span>}
        <StatusBadge status={entry.status} className="ml-auto font-semibold px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1">
          {entry.status}
          {(entry.admin_note || linkedTripCancelled) && (
            <span title={linkedTripCancelled ? t('home.shared.tripCancelled') : (entry.admin_note ?? '')} style={{ cursor: 'help', fontSize: 10, lineHeight: 1 }}>ⓘ</span>
          )}
        </StatusBadge>
        {head.proof_url && (
          <a href={head.proof_url} target="_blank" rel="noopener noreferrer"
            className="flex-shrink-0 hover:underline" style={{ color: 'var(--brand-teal)' }}>{t('home.shared.proofLink')}</a>
        )}
      </div>
      {/* truncate + min-w-0: at 390px an untruncatable list of names would push
          the card past the viewport. */}
      {(detail || forNames.length > 0 || paidBy) && (
        <p className="mt-1 truncate min-w-0 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
          {detail}
          {detail && (forNames.length > 0 || paidBy) ? ' · ' : ''}
          {forNames.length > 0 && `${t('payment.for')} ${forNames.join(', ')}`}
          {paidBy && `${t('payment.paidBy')} ${paidBy}`}
        </p>
      )}
    </div>
  )
}
