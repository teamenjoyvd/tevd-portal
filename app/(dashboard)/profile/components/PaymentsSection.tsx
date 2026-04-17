'use client'

import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { Drawer } from '@/components/ui/Drawer'
import { PaymentForm } from '@/components/payment/PaymentForm'
import { formatCurrency } from '@/lib/format'
import { type TripEntry, type GenericPayment, type PayableItem, VARIABLE_CAP } from '../types'
import { PaymentRow, ShowMoreButton } from './shared'

export const PAYMENTS_MIN_HEIGHT = 280

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
    queryFn: () => fetch('/api/payments').then(r => r.json()),
    enabled,
    staleTime: 2 * 60 * 1000,
  })

  const { data: payableItems } = useQuery<PayableItem[]>({
    queryKey: ['payable-items'],
    queryFn: () => fetch('/api/payable-items').then(r => r.json()),
    enabled,
    staleTime: 5 * 60 * 1000,
  })

  const { data: tripsData } = useQuery<TripEntry[]>({
    queryKey: ['profile-trips'],
    queryFn: () => fetch('/api/profile/payments').then(r => r.json()),
    enabled,
    staleTime: 2 * 60 * 1000,
  })

  const cancelledTripIds = new Set(
    (tripsData ?? []).filter(e => e.cancelled_at).map(e => e.trip?.id).filter(Boolean) as string[]
  )

  function closeSubmitDrawer() {
    setSubmitDrawerOpen(false)
  }

  const handleOpenSubmit = useCallback(() => setSubmitDrawerOpen(true), [])

  if (isLoading) {
    return <div className="rounded-2xl animate-pulse h-full" style={{ backgroundColor: 'var(--border-default)' }} />
  }

  const allPayments = paymentsData ?? []
  const visiblePayments = allPayments.slice(0, VARIABLE_CAP)
  const overflow = allPayments.length - VARIABLE_CAP

  const visibleByItem = groupByItem(visiblePayments)
  const allByItem     = groupByItem(allPayments)

  return (
    <>
      <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-center justify-between mb-4 pr-16">
          <p className="text-xs font-semibold tracking-[0.25em] uppercase" style={{ color: 'var(--brand-crimson)' }}>{t('payment.title')}</p>
          <button onClick={handleOpenSubmit}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-opacity flex-shrink-0"
            style={{ backgroundColor: 'var(--brand-forest)' }}>{t('payment.submitShort')}</button>
        </div>
        {Object.keys(visibleByItem).length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('payment.none')}</p>
        ) : (
          <PaymentGroups groups={visibleByItem} cancelledTripIds={cancelledTripIds} />
        )}
        {overflow > 0 && <ShowMoreButton count={overflow} onClick={() => setListDrawerOpen(true)} />}
      </div>

      <Drawer open={submitDrawerOpen} onClose={closeSubmitDrawer} title={t('payment.submit')}>
        <PaymentForm
          context="generic"
          payableItems={payableItems ?? []}
          onSuccess={closeSubmitDrawer}
          onCancel={closeSubmitDrawer}
        />
      </Drawer>

      <Drawer open={listDrawerOpen} onClose={() => setListDrawerOpen(false)} title={t('payment.allPayments')}>
        <div className="space-y-4 mb-6">
          <PaymentGroups groups={allByItem} cancelledTripIds={cancelledTripIds} />
        </div>
        <div className="border-t pt-4" style={{ borderColor: 'var(--border-default)' }}>
          <button
            onClick={() => { setListDrawerOpen(false); setSubmitDrawerOpen(true) }}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'var(--brand-forest)' }}
          >
            {t('payment.submitShort')}
          </button>
        </div>
      </Drawer>
    </>
  )
}
