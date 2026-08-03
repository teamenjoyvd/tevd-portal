'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CreditCard } from 'lucide-react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { Drawer } from '@/components/ui/drawer'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatCurrency } from '@/lib/format'
import { beneficiaryLabel } from '@/lib/payments/labels'
import { currencyOf, ledgerEntries, titleOf } from '@/lib/payments/ledger'
import { PaymentForm } from '@/components/payment/PaymentForm'
import { BentoHeader } from './BentoHeader'
import { BentoSkeleton } from './BentoSkeleton'
import { BentoEmpty } from './BentoEmpty'
import { type TripEntry, type GenericPayment, type PayableItem, VARIABLE_CAP } from '../types'
import { PaymentRow } from './shared'
import { apiClient } from '@/lib/apiClient'

/**
 * Pending groups I paid for, collapsed to one card each (2607-DEV-676).
 *
 * A group is N sibling rows from ONE transfer, so listing them individually
 * would read as N separate payments. Only still-pending groups appear here:
 * once an admin approves, withdrawal is no longer possible and the rows belong
 * in the normal history.
 */
function pendingGroupsIPaidFor(payments: GenericPayment[], myProfileId: string) {
  const groups = new Map<string, GenericPayment[]>()
  for (const pay of payments) {
    if (!pay.payment_group_id) continue
    if (pay.paid_by_profile_id !== myProfileId) continue
    if (pay.admin_status !== 'pending') continue
    const existing = groups.get(pay.payment_group_id)
    if (existing) existing.push(pay)
    else groups.set(pay.payment_group_id, [pay])
  }
  return [...groups.entries()].map(([groupId, rows]) => ({
    groupId,
    rows,
    total: rows.reduce((acc, r) => acc + Number(r.amount), 0),
    currency: currencyOf(rows[0]),
    title: titleOf(rows[0]),
  }))
}

export function PaymentsSection({ profileId, role }: { profileId: string; role: string }) {
  const { t } = useLanguage()
  const qc = useQueryClient()
  const [submitDrawerOpen, setSubmitDrawerOpen] = useState(false)

  const enabled = !!profileId && role !== 'guest'

  const { data: paymentsData, isLoading } = useQuery<GenericPayment[]>({
    queryKey: ['profile-generic-payments'],
    queryFn: () => apiClient('/api/payments'),
    enabled,
    staleTime: 2 * 60 * 1000,
  })

  const { data: payableItems } = useQuery<PayableItem[]>({
    queryKey: ['payable-items'],
    queryFn: () => apiClient('/api/payable-items'),
    enabled,
    staleTime: 5 * 60 * 1000,
  })

  const { data: tripsData } = useQuery<TripEntry[]>({
    queryKey: ['profile-trips'],
    queryFn: () => apiClient('/api/profile/payments'),
    enabled,
    staleTime: 2 * 60 * 1000,
  })

  const cancelledTripIds = new Set(
    (tripsData ?? []).filter(e => e.cancelled_at).map(e => e.trip?.id).filter(Boolean) as string[]
  )

  const [withdrawTargetId, setWithdrawTargetId] = useState<string | null>(null)

  const withdrawMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const res = await fetch(`/api/payments/group/${groupId}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Withdraw failed')
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile-generic-payments'] })
      setWithdrawTargetId(null)
    },
  })

  function closeSubmitDrawer() {
    setSubmitDrawerOpen(false)
  }

  const handleOpenSubmit = useCallback(() => setSubmitDrawerOpen(true), [])

  if (isLoading) {
    return (
      <div>
        <BentoHeader icon={CreditCard} title={t('payment.title')} />
        <BentoSkeleton rows={3} />
      </div>
    )
  }

  const allPayments = paymentsData ?? []

  // Rows I paid for on someone else's ledger are shown as group cards, so they
  // are excluded from the per-item history to avoid listing the same transfer
  // twice. My own row inside a group stays in the history where it belongs.
  const paidGroups = pendingGroupsIPaidFor(allPayments, profileId)
  const paidGroupIds = new Set(paidGroups.map(g => g.groupId))
  // profile_id first: every row in a group shares one payer, so when the payer
  // included THEMSELVES as a beneficiary their own row's group is in
  // paidGroupIds too, and a group-membership test alone would delete it from
  // their history — the opposite of what the comment above promises.
  const ledgerPayments = allPayments.filter(
    pay =>
      pay.profile_id === profileId ||
      !(pay.payment_group_id && paidGroupIds.has(pay.payment_group_id)),
  )

  // VARIABLE_CAP now caps collapsed ENTRIES, not raw rows: the bento's unit is
  // "latest transactions", and one on-behalf group IS one transaction.
  const entries = ledgerEntries(ledgerPayments, profileId)
  const visibleEntries = entries.slice(0, VARIABLE_CAP)

  return (
    <>
      <div>
        <BentoHeader
          icon={CreditCard}
          title={t('payment.title')}
          action={
            <button onClick={handleOpenSubmit}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity flex-shrink-0"
              style={{ backgroundColor: 'var(--brand-forest)', color: 'var(--brand-parchment)' }}>{t('payment.submitShort')}</button>
          }
        />
        {/* Pending groups I submitted for other people. One card per transfer,
            withdrawable until an admin resolves it. */}
        {paidGroups.length > 0 && (
          <div className="space-y-1.5 mb-4">
            {paidGroups.map(group => (
              <div
                key={group.groupId}
                className="rounded-xl px-3 py-2.5"
                style={{ border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-global)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {formatCurrency(group.total, group.currency)}
                      {group.title ? ` · ${group.title}` : ''}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                      {t('payment.for')}{' '}
                      {group.rows.map(r => beneficiaryLabel(r, t('payment.guestTag'))).join(', ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWithdrawTargetId(group.groupId)}
                    className="flex-shrink-0 text-xs font-semibold transition-opacity hover:opacity-70"
                    style={{ background: 'none', border: 'none', color: '#bc4749', cursor: 'pointer', minHeight: '32px' }}
                  >
                    {t('payment.withdraw')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {visibleEntries.length === 0 && paidGroups.length === 0 ? (
          <BentoEmpty message={t('payment.none')} />
        ) : (
          <div className="space-y-1.5">
            {visibleEntries.map(entry => (
              <PaymentRow key={entry.key} entry={entry} me={profileId} cancelledTripIds={cancelledTripIds} />
            ))}
          </div>
        )}
        {/* A link, not a drawer: /profile/payments shares the
            ['profile-generic-payments'] query key, so client-side navigation
            mounts it warm off this cache with no refetch. */}
        {entries.length > 0 && (
          <Link
            href="/profile/payments"
            className="inline-block mt-3 text-xs font-semibold hover:opacity-70 transition-opacity"
            style={{ color: 'var(--brand-crimson)' }}
          >
            {t('payment.viewAll')}
          </Link>
        )}
      </div>

      <Drawer open={submitDrawerOpen} onClose={closeSubmitDrawer} title={t('payment.submit')}>
        <PaymentForm
          context="generic"
          payableItems={payableItems ?? []}
          allowOnBehalf
          onSuccess={closeSubmitDrawer}
          onCancel={closeSubmitDrawer}
        />
      </Drawer>

      <AlertDialog
        open={withdrawTargetId !== null}
        onOpenChange={open => {
          if (!open && !withdrawMutation.isPending) {
            setWithdrawTargetId(null)
            // Drop a previous failure so reopening the dialog does not lead with
            // a stale error.
            withdrawMutation.reset()
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('payment.withdrawTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('payment.withdrawBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          {/* Without this the dialog just stays open with the buttons live again
              — a failed DELETE (already approved, RPC error) would look like
              nothing happened at all. mutationFn always throws an Error with the
              API's own message, so there is nothing to fall back to. */}
          {withdrawMutation.isError && (
            <p className="text-xs" style={{ color: '#bc4749' }}>
              {withdrawMutation.error.message}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={withdrawMutation.isPending}>
              {t('payment.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={withdrawMutation.isPending}
              onClick={e => {
                e.preventDefault()
                if (withdrawTargetId !== null) withdrawMutation.mutate(withdrawTargetId)
              }}
            >
              {withdrawMutation.isPending ? t('payment.withdrawing') : t('payment.withdraw')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  )
}
