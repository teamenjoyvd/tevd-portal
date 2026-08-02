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
import { guestLabel } from '@/lib/payments/labels'
import { type TripEntry, type GenericPayment } from '../types'
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

export function PaymentRow({
  pay,
  cancelledTripIds,
}: {
  pay: GenericPayment
  cancelledTripIds: Set<string>
}) {
  const { t } = useLanguage()
  const linkedTripCancelled = pay.payable_items?.item_type === 'trip' && cancelledTripIds.size > 0
  // A guest row sits on the PAYER's ledger (2607-DEV-677), so without this it
  // appears in their own history as an unexplained second payment of the same
  // fee. Null on every ordinary row, which is every row that existed before.
  const guestMarker = guestLabel(pay, t('payment.guestTag'))
  return (
    <div
      className="flex items-center gap-2 text-xs rounded-xl px-3 py-2"
      style={{ backgroundColor: 'var(--bg-global)' }}
    >
      <span className="font-semibold flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
        {formatCurrency(pay.amount, pay.payable_items?.currency ?? 'EUR')}
      </span>
      <span style={{ color: 'var(--text-secondary)' }}>{formatDate(pay.transaction_date)}</span>
      {pay.payment_method && <span style={{ color: 'var(--text-secondary)' }}>{pay.payment_method}</span>}
      {/* min-w-0 + truncate: at 390px this row is already tight, and an
          untruncatable name would push the status badge past the viewport. */}
      {guestMarker && (
        <span className="truncate min-w-0" style={{ color: 'var(--text-secondary)' }}>
          {t('payment.for')} {guestMarker}
        </span>
      )}
      <StatusBadge status={pay.admin_status} className="ml-auto font-semibold px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1">
        {pay.admin_status}
        {(pay.admin_note || linkedTripCancelled) && (
          <span title={linkedTripCancelled ? t('home.shared.tripCancelled') : (pay.admin_note ?? '')} style={{ cursor: 'help', fontSize: 10, lineHeight: 1 }}>ⓘ</span>
        )}
      </StatusBadge>
      {pay.proof_url && (
        <a href={pay.proof_url} target="_blank" rel="noopener noreferrer"
          className="flex-shrink-0 hover:underline" style={{ color: 'var(--brand-teal)' }}>{t('home.shared.proofLink')}</a>
      )}
    </div>
  )
}
