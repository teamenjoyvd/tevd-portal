'use client'

import { useState } from 'react'
import { formatDate, formatCurrency } from '@/lib/format'
import { useLanguage } from '@/lib/hooks/useLanguage'
import type { Payment } from '@/lib/types/payments'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

/**
 * One on-behalf payment group in the admin queue (2607-DEV-676).
 *
 * Deliberately has NO per-row control. The rows came from one real transfer with
 * one proof; approving half of them would credit one person's ledger and not the
 * other's from money that either arrived or did not. /api/admin/payments/[id]
 * 409s on these rows, so this card is the only way to resolve them.
 */
export function PaymentGroupCard({
  groupId,
  rows,
  note,
  setNote,
  onApprove,
  onReject,
  isPending,
}: {
  groupId: string
  rows: Payment[]
  note: string
  setNote: (value: string) => void
  onApprove: (groupId: string, note: string | null) => void
  onReject: (groupId: string, note: string) => void
  isPending: boolean
}) {
  const { t } = useLanguage()
  const [rejectOpen, setRejectOpen] = useState(false)

  const first = rows[0]
  const total = rows.reduce((acc, r) => acc + Number(r.amount), 0)
  const itemTitle = first.trips?.title ?? first.payable_items?.title ?? '—'
  const payerName = first.payer ? `${first.payer.first_name} ${first.payer.last_name}` : '—'

  // An absent note and an empty note both mean "no admin note" — collapsed
  // explicitly rather than truthiness-checking a string that can be ''.
  const approveNote = note === '' ? null : note
  const canReject = note.trim() !== ''

  return (
    <div className="px-5 py-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('payment.paidBy')} {payerName}
            {first.payer?.abo_number && (
              <span className="font-mono font-normal ml-2 text-xs opacity-60">{first.payer.abo_number}</span>
            )}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {itemTitle}
            {' · '}{formatDate(first.transaction_date)}
            {' · '}{formatCurrency(total, first.currency)}
            {' · '}{rows.length} {t('payment.groupOf')}
            {first.payment_method && ` · ${first.payment_method}`}
          </p>

          {/* One line per beneficiary — what each person's ledger will receive. */}
          <ul className="mt-2 space-y-0.5">
            {rows.map(row => (
              <li key={row.id} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {/* A guest row's `profiles` is the PAYER, not the beneficiary —
                    a guest has no ledger (2607-DEV-677). Showing that name here
                    would list the payer twice and hide who the money is for. */}
                {row.payment_guests ? (
                  <>
                    <span style={{ color: 'var(--text-primary)' }}>{row.payment_guests.name}</span>
                    {row.payment_guests.linked_profile_id === null && (
                      <span
                        className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold align-middle"
                        style={{ backgroundColor: '#f2cc8f33', color: '#7a5c00' }}
                      >
                        {t('payment.guestUnlinked')}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span style={{ color: 'var(--text-primary)' }}>
                      {row.profiles?.first_name} {row.profiles?.last_name}
                    </span>
                    {row.profiles?.abo_number && (
                      <span className="font-mono ml-1.5 opacity-60">{row.profiles.abo_number}</span>
                    )}
                  </>
                )}
                {' — '}{formatCurrency(Number(row.amount), row.currency)}
              </li>
            ))}
          </ul>

          {first.note && (
            <p className="text-xs mt-1 italic" style={{ color: 'var(--text-secondary)' }}>{first.note}</p>
          )}

          {/* One shared proof for the whole group. */}
          {first.proof_url && (
            <a
              href={`/api/admin/payments/${first.id}/proof`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs hover:underline"
              style={{ color: 'var(--brand-teal)' }}
            >
              {t('admin.operations.payments.viewProof')}
            </a>
          )}
        </div>

        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: '#f2cc8f33', color: '#7a5c00' }}
        >
          {t('admin.operations.payments.badge.pending')}
        </span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder={t('admin.operations.payments.placeholder.adminNote')}
          className="flex-1 border rounded-xl px-3 py-2 text-xs"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
        />
        <div className="flex gap-2 sm:contents">
          <button
            onClick={() => onApprove(groupId, approveNote)}
            disabled={isPending}
            className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity sm:flex-shrink-0"
            style={{ backgroundColor: '#2d6a4f' }}
          >
            {t('payment.approveGroup')}
          </button>
          <button
            onClick={() => setRejectOpen(true)}
            disabled={isPending}
            className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity sm:flex-shrink-0"
            style={{ backgroundColor: 'var(--brand-crimson)' }}
          >
            {t('payment.rejectGroup')}
          </button>
        </div>
      </div>

      <AlertDialog
        open={rejectOpen}
        onOpenChange={open => { if (!open && !isPending) setRejectOpen(false) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('payment.rejectGroup')}</AlertDialogTitle>
            <AlertDialogDescription>
              {/* The reason reaches the payer verbatim in the rejection email —
                  one email for the group, not one per beneficiary. */}
              {canReject ? t('payment.rejectReason') : t('payment.rejectReasonRequired')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>{t('payment.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending || !canReject}
              onClick={e => {
                e.preventDefault()
                if (!canReject) return
                onReject(groupId, note)
                setRejectOpen(false)
              }}
            >
              {t('payment.rejectGroup')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
