'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { formatDate, formatCurrency } from '@/lib/format'
import { t } from '@/lib/i18n'
import type { Payment } from '@/lib/types/payments'
import { PendingPaymentsSection } from './PendingPaymentsSection'
import { LogPaymentDrawer } from './LogPaymentDrawer'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// ── Helpers ──────────────────────────────────────────────

function statusPill(status: string) {
  if (status === 'approved' || status === 'completed') {
    return { bg: '#81b29a33', color: '#2d6a4f' }
  }
  if (status === 'rejected' || status === 'denied' || status === 'failed') {
    return { bg: 'rgba(188,71,73,0.1)', color: 'var(--brand-crimson)' }
  }
  return { bg: '#f2cc8f33', color: '#7a5c00' }
}

// ── Component ────────────────────────────────────────────

export function PaymentsClient({
  initialPayments,
  initialPending,
}: {
  initialPayments: Payment[]
  initialPending: Payment[]
}) {
  const router = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
  const [payError, setPayError] = useState<string | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  const payments = useMemo(
    () => statusFilter === 'all'
      ? initialPayments
      : initialPayments.filter(p => p.admin_status === statusFilter),
    [initialPayments, statusFilter]
  )

  const logMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json() }),
    onSuccess: () => {
      setDrawerOpen(false)
      setPayError(null)
      router.refresh()
    },
    onError: (e: Error) => setPayError(e.message),
  })

  const reviewMutation = useMutation({
    mutationFn: ({ id, admin_status, admin_note }: { id: string; admin_status: string; admin_note: string | null }) =>
      fetch(`/api/admin/payments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_status, admin_note }),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json() }),
    onSuccess: () => router.refresh(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/payments/${id}`, { method: 'DELETE' })
        .then(async r => { if (!r.ok) throw new Error((await r.json()).error) }),
    onSuccess: () => {
      setDeleteTargetId(null)
      router.refresh()
    },
    onSettled: () => setDeleteTargetId(null),
  })

  const STATUS_FILTERS = [
    { key: 'all' as const,      labelKey: 'admin.operations.payments.filter.all' as const },
    { key: 'pending' as const,  labelKey: 'admin.operations.payments.filter.pending' as const },
    { key: 'approved' as const, labelKey: 'admin.operations.payments.filter.approved' as const },
    { key: 'rejected' as const, labelKey: 'admin.operations.payments.filter.rejected' as const },
  ]

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Payments
        </h1>
        <button
          onClick={() => setDrawerOpen(true)}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--brand-crimson)' }}
        >
          {t('admin.operations.payments.btn.log', 'en')}
        </button>
      </div>

      <PendingPaymentsSection
        payments={initialPending}
        reviewNotes={reviewNotes}
        setReviewNotes={setReviewNotes}
        onApprove={(id, note) => reviewMutation.mutate({ id, admin_status: 'approved', admin_note: note })}
        onReject={(id, note) => reviewMutation.mutate({ id, admin_status: 'rejected', admin_note: note })}
        isPending={reviewMutation.isPending}
      />

      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{
              backgroundColor: statusFilter === f.key ? 'var(--text-primary)' : 'rgba(0,0,0,0.06)',
              color: statusFilter === f.key ? 'var(--bg-card)' : 'var(--text-secondary)',
            }}>
            {t(f.labelKey, 'en')}
          </button>
        ))}
      </div>

      {payments.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.payments.empty', 'en')}</p>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
          {payments.map((p, i) => {
            const pill = statusPill(p.admin_status)
            const entityLabel = p.trips?.title ?? p.payable_items?.title ?? '—'
            const isDeleting = deleteMutation.isPending && deleteTargetId === p.id
            return (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-4"
                style={{ borderTop: i > 0 ? '1px solid var(--border-default)' : 'none' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {p.profiles?.first_name} {p.profiles?.last_name}
                    {p.profiles?.abo_number && <span className="font-mono text-xs opacity-60 ml-1.5">{p.profiles.abo_number}</span>}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {entityLabel} · {formatDate(p.transaction_date)} · {formatCurrency(p.amount, p.currency)}
                    {p.payment_method && ` · ${p.payment_method}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: pill.bg, color: pill.color }}>
                    {p.admin_status}
                  </span>
                  <button
                    onClick={() => setDeleteTargetId(p.id)}
                    disabled={isDeleting}
                    className="text-xs px-2 py-1 rounded-lg border transition-colors hover:bg-black/5 disabled:opacity-40"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--brand-crimson)' }}
                    aria-label="Delete payment"
                  >
                    {isDeleting ? '…' : 'Delete'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AlertDialog open={deleteTargetId !== null} onOpenChange={open => { if (!open) setDeleteTargetId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteTargetId) deleteMutation.mutate(deleteTargetId) }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <LogPaymentDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setPayError(null) }}
        onSave={logMutation.mutate}
        isPending={logMutation.isPending}
        externalError={payError}
      />
    </section>
  )
}
