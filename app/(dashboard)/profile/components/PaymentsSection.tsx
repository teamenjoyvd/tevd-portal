'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Drawer } from '@/components/ui/Drawer'
import { formatDate, formatCurrency } from '@/lib/format'
import {
  type TripEntry,
  type GenericPayment,
  type PayableItem,
  VARIABLE_CAP,
  PaymentRow,
  ShowMoreButton,
} from '../types'

export const PAYMENTS_MIN_HEIGHT = 280

export function PaymentsSection({ profileId, role }: { profileId: string; role: string }) {
  const qc = useQueryClient()
  const [submitDrawerOpen, setSubmitDrawerOpen] = useState(false)
  const [listDrawerOpen, setListDrawerOpen]     = useState(false)

  // Payment form state
  const [payModalItemId, setPayModalItemId]   = useState('')
  const [payModalAmount, setPayModalAmount]   = useState('')
  const [payModalDate, setPayModalDate]       = useState('')
  const [payModalMethod, setPayModalMethod]   = useState('')
  const [payModalNote, setPayModalNote]       = useState('')
  const [payModalFile, setPayModalFile]       = useState<File | null>(null)

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

  // Duplicate query — same key as TripsSection. TanStack deduplicates the network request.
  const { data: tripsData } = useQuery<TripEntry[]>({
    queryKey: ['profile-trips'],
    queryFn: () => fetch('/api/profile/payments').then(r => r.json()),
    enabled,
    staleTime: 2 * 60 * 1000,
  })

  const cancelledTripIds = new Set(
    (tripsData ?? []).filter(e => e.cancelled_at).map(e => e.trip?.id).filter(Boolean) as string[]
  )

  const submitPayment = useMutation({
    mutationFn: async () => {
      let proofUrl: string | null = null
      if (payModalFile) {
        const fd = new FormData()
        fd.append('file', payModalFile)
        const uploadRes = await fetch('/api/profile/payments/upload', { method: 'POST', body: fd })
        if (!uploadRes.ok) throw new Error('File upload failed')
        proofUrl = (await uploadRes.json()).url
      }
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payable_item_id:  payModalItemId,
          amount:           parseFloat(payModalAmount),
          transaction_date: payModalDate,
          payment_method:   payModalMethod || null,
          proof_url:        proofUrl,
          note:             payModalNote || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile-generic-payments'] })
      closeSubmitDrawer()
    },
  })

  function closeSubmitDrawer() {
    setSubmitDrawerOpen(false)
    setPayModalItemId(''); setPayModalAmount(''); setPayModalDate('')
    setPayModalMethod(''); setPayModalNote(''); setPayModalFile(null)
    submitPayment.reset()
  }

  const handleOpenSubmit = useCallback(() => setSubmitDrawerOpen(true), [])

  if (isLoading) {
    return <div className="rounded-2xl animate-pulse h-full" style={{ backgroundColor: 'var(--border-default)' }} />
  }

  const allPayments = paymentsData ?? []
  const visiblePayments = allPayments.slice(0, VARIABLE_CAP)
  const overflow = allPayments.length - VARIABLE_CAP

  const groupByItem = (payments: GenericPayment[]) => {
    const map: Record<string, GenericPayment[]> = {}
    for (const pay of payments) {
      const key = pay.payable_items?.title ?? 'Unknown'
      if (!map[key]) map[key] = []
      map[key].push(pay)
    }
    return map
  }

  const visibleByItem  = groupByItem(visiblePayments)
  const allByItem      = groupByItem(allPayments)

  const PaymentGroups = ({ groups }: { groups: Record<string, GenericPayment[]> }) => (
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

  return (
    <>
      <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-center justify-between mb-4 pr-16">
          <p className="text-xs font-semibold tracking-[0.25em] uppercase" style={{ color: 'var(--brand-crimson)' }}>Payments</p>
          <button onClick={handleOpenSubmit}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-opacity flex-shrink-0"
            style={{ backgroundColor: 'var(--brand-forest)' }}>+ Submit payment</button>
        </div>
        {Object.keys(visibleByItem).length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>No payments logged yet.</p>
        ) : (
          <PaymentGroups groups={visibleByItem} />
        )}
        {overflow > 0 && <ShowMoreButton count={overflow} onClick={() => setListDrawerOpen(true)} />}
      </div>

      {/* Submit Payment Drawer */}
      <Drawer open={submitDrawerOpen} onClose={closeSubmitDrawer} title="Submit Payment">
        <div className="space-y-4">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Item</label>
            <select value={payModalItemId} onChange={e => setPayModalItemId(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 text-sm"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }}>
              <option value="">Select an item…</option>
              {(payableItems ?? []).map(item => (
                <option key={item.id} value={item.id}>{item.title} — {formatCurrency(item.amount, item.currency)}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Amount</label>
              <input type="number" min="0" step="0.01" value={payModalAmount} onChange={e => setPayModalAmount(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Date</label>
              <input type="date" value={payModalDate} onChange={e => setPayModalDate(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }} />
            </div>
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Payment method</label>
            <input value={payModalMethod} onChange={e => setPayModalMethod(e.target.value)}
              placeholder="e.g. bank transfer, cash"
              className="w-full border rounded-xl px-3 py-2 text-sm"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }} />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Proof of payment <span className="opacity-60 font-normal">(optional)</span></label>
            <input type="file" accept="image/*,.pdf" onChange={e => setPayModalFile(e.target.files?.[0] ?? null)}
              className="w-full text-xs" style={{ color: 'var(--text-secondary)' }} />
            {payModalFile && <p className="text-[11px] mt-1" style={{ color: 'var(--brand-teal)' }}>{payModalFile.name}</p>}
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Note</label>
            <textarea value={payModalNote} onChange={e => setPayModalNote(e.target.value)}
              rows={2} className="w-full border rounded-xl px-3 py-2 text-sm resize-none"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }} />
          </div>
          {submitPayment.isError && (
            <p className="text-xs" style={{ color: 'var(--brand-crimson)' }}>{(submitPayment.error as Error).message}</p>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={closeSubmitDrawer}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border hover:bg-black/5 transition-colors"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>Cancel</button>
            <button
              onClick={() => submitPayment.mutate()}
              disabled={submitPayment.isPending || !payModalItemId || !payModalAmount || !payModalDate}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
              style={{ backgroundColor: 'var(--brand-forest)' }}>
              {submitPayment.isPending ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </div>
      </Drawer>

      {/* All Payments Drawer */}
      <Drawer open={listDrawerOpen} onClose={() => setListDrawerOpen(false)} title="All Payments">
        <div className="space-y-4 mb-6">
          <PaymentGroups groups={allByItem} />
        </div>
        <div className="border-t pt-4" style={{ borderColor: 'var(--border-default)' }}>
          <button
            onClick={() => { setListDrawerOpen(false); setSubmitDrawerOpen(true) }}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'var(--brand-forest)' }}
          >
            + Submit payment
          </button>
        </div>
      </Drawer>
    </>
  )
}
