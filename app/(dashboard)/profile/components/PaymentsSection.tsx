'use client'

import { useState, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CreditCard } from 'lucide-react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { Drawer } from '@/components/ui/drawer'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatCurrency } from '@/lib/format'
import { PaymentForm } from '@/components/payment/PaymentForm'
import { BentoHeader } from './BentoHeader'
import { BentoSkeleton } from './BentoSkeleton'
import { BentoEmpty } from './BentoEmpty'
import { type TripEntry, type GenericPayment, type PayableItem, VARIABLE_CAP } from '../types'
import { PaymentRow, ShowMoreButton } from './shared'
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
    currency: rows[0].payable_items?.currency ?? 'EUR',
    title: rows[0].payable_items?.title ?? '',
  }))
}

function groupByItem(payments: GenericPayment[]): Record<string, GenericPayment[]> {
  const map: Record<string, GenericPayment[]> = {}
  for (const pay of payments) {
    const key = pay.payable_items?.title ?? 'Unknown'
    if (!map[key]) map[key] = []
    map[key].push(pay)
  }
  return map
}

function PaymentGroups({
  groups,
  cancelledTripIds,
}: {
  groups: Record<string, GenericPayment[]>
  cancelledTripIds: Set<string>
}) {
  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([itemTitle, itemPayments]) => (
        <div key={itemTitle}>
          <p className="text-[11px] font-semibold tracking-widest uppercase mb-1.5" style={{ color: 'var(--text-secondary)' }}>{itemTitle}</p>
          <div className="space-y-1.5">
            {itemPayments.map(pay => (
              <PaymentRow key={pay.id} pay={pay} cancelledTripIds={cancelledTripIds} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function PaymentsSection({ profileId, role }: { profileId: string; role: string }) {
  const { t } = useLanguage()
  const qc = useQueryClient()
  const [submitDrawerOpen, setSubmitDrawerOpen] = useState(false)
  const [listDrawerOpen, setListDrawerOpen]     = useState(false)

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
  const ledgerPayments = allPayments.filter(
    pay => !(pay.payment_group_id && paidGroupIds.has(pay.payment_group_id)),
  )

  const visiblePayments = ledgerPayments.slice(0, VARIABLE_CAP)
  const overflow = ledgerPayments.length - VARIABLE_CAP

  const visibleByItem = groupByItem(visiblePayments)
  const allByItem     = groupByItem(ledgerPayments)

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
                      {group.rows
                        .map(r => (r.beneficiary ? `${r.beneficiary.first_name} ${r.beneficiary.last_name}` : '—'))
                        .join(', ')}
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

        {Object.keys(visibleByItem).length === 0 && paidGroups.length === 0 ? (
          <BentoEmpty message={t('payment.none')} />
        ) : (
          <PaymentGroups groups={visibleByItem} cancelledTripIds={cancelledTripIds} />
        )}
        {overflow > 0 && <ShowMoreButton count={overflow} onClick={() => setListDrawerOpen(true)} />}
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
        onOpenChange={open => { if (!open && !withdrawMutation.isPending) setWithdrawTargetId(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('payment.withdrawTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('payment.withdrawBody')}</AlertDialogDescription>
          </AlertDialogHeader>
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

      <Drawer open={listDrawerOpen} onClose={() => setListDrawerOpen(false)} title={t('payment.allPayments')}>
        <div className="space-y-4 mb-6">
          <PaymentGroups groups={allByItem} cancelledTripIds={cancelledTripIds} />
        </div>
        <div className="border-t pt-4" style={{ borderColor: 'var(--border-default)' }}>
          <button
            onClick={() => { setListDrawerOpen(false); setSubmitDrawerOpen(true) }}
            className="w-full py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'var(--brand-forest)', color: 'var(--brand-parchment)' }}
          >
            {t('payment.submitShort')}
          </button>
        </div>
      </Drawer>
    </>
  )
}
