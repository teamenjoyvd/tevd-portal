'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { formatDate, formatCurrency } from '@/lib/format'
import { useLanguage } from '@/lib/hooks/useLanguage'
import type { Payment } from '@/lib/types/payments'
import { PendingPaymentsSection } from './PendingPaymentsSection'
import { LogPaymentDrawer } from './LogPaymentDrawer'
import { GuestLinkPanel } from './GuestLinkPanel'
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
  const { t, lang } = useLanguage()
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

  // Blast radius of the pending delete, or null when the target is a plain
  // single row. Read from initialPayments, not `payments` — the status filter
  // is exactly what hides the siblings the admin is about to destroy.
  const deleteGroupScope = useMemo(() => {
    if (deleteTargetId === null) return null
    const groupId = initialPayments.find(p => p.id === deleteTargetId)?.payment_group_id
    if (!groupId) return null
    const siblings = initialPayments.filter(p => p.payment_group_id === groupId)
    return {
      count: siblings.length,
      statuses: [...new Set(siblings.map(p => p.admin_status))].sort(),
    }
  }, [deleteTargetId, initialPayments])

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

  // Groups are resolved as a unit — /api/admin/payments/[id] 409s on any row
  // carrying a payment_group_id, so a group never reaches reviewMutation.
  // NOTE: review failures must NOT go to setPayError — payError renders only
  // inside LogPaymentDrawer, which is closed during a review, so the admin
  // would see nothing at all. They surface next to the pending queue instead.
  const reviewGroupMutation = useMutation({
    mutationFn: ({ groupId, admin_status, admin_note }: { groupId: string; admin_status: string; admin_note: string | null }) =>
      fetch(`/api/admin/payments/group/${groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_status, admin_note }),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json() }),
    onSuccess: () => router.refresh(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      // A grouped row must be deleted as a group: the single-row endpoint 409s
      // on it, and deleting one sibling would orphan the rest and leave the
      // payer's total silently short.
      const row = initialPayments.find(p => p.id === id)
      const url = row?.payment_group_id
        ? `/api/admin/payments/group/${row.payment_group_id}`
        : `/api/admin/payments/${id}`
      return fetch(url, { method: 'DELETE' })
        .then(async r => { if (!r.ok) throw new Error((await r.json()).error) })
    },
    onSuccess: () => router.refresh(),
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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          {t('admin.operations.payments.title')}
        </h1>
        <button
          onClick={() => setDrawerOpen(true)}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--brand-crimson)' }}
        >
          {t('admin.operations.payments.btn.log')}
        </button>
      </div>

      <PendingPaymentsSection
        payments={initialPending}
        reviewNotes={reviewNotes}
        setReviewNotes={setReviewNotes}
        onApprove={(id, note) => reviewMutation.mutate({ id, admin_status: 'approved', admin_note: note })}
        onReject={(id, note) => reviewMutation.mutate({ id, admin_status: 'rejected', admin_note: note })}
        onApproveGroup={(groupId, note) => reviewGroupMutation.mutate({ groupId, admin_status: 'approved', admin_note: note })}
        onRejectGroup={(groupId, note) => reviewGroupMutation.mutate({ groupId, admin_status: 'rejected', admin_note: note })}
        isPending={reviewMutation.isPending || reviewGroupMutation.isPending}
      />

      {/* Approve/reject/delete all mutate then router.refresh(). On failure the
          row simply stays put, which is indistinguishable from "nothing was
          clicked" — so the reason has to be shown here, beside the queue the
          admin is looking at. */}
      {(reviewMutation.isError || reviewGroupMutation.isError || deleteMutation.isError) && (
        <p className="text-xs" style={{ color: 'var(--brand-crimson)' }} role="alert">
          {(reviewGroupMutation.error ?? reviewMutation.error ?? deleteMutation.error)?.message}
        </p>
      )}

      {/* Below the pending queue: linking a guest is reconciliation work and is
          never urgent (2607-DEV-677). The panel renders nothing while its fetch
          is in flight; once loaded it always renders its card, an empty guest
          list included, so that "no guests to link" is a stated result rather
          than a blank space. */}
      <GuestLinkPanel />

      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{
              backgroundColor: statusFilter === f.key ? 'var(--text-primary)' : 'rgba(0,0,0,0.06)',
              color: statusFilter === f.key ? 'var(--bg-card)' : 'var(--text-secondary)',
            }}>
            {t(f.labelKey)}
          </button>
        ))}
      </div>

      {payments.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.payments.empty')}</p>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
          {payments.map((p, i) => {
            const pill = statusPill(p.admin_status)
            const entityLabel = p.trips?.title ?? p.payable_items?.title ?? '—'
            const isDeleting = deleteMutation.isPending && deleteTargetId === p.id
            return (
              <div key={p.id} className="px-5 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                style={{ borderTop: i > 0 ? '1px solid var(--border-default)' : 'none' }}>
                <div className="flex-1 min-w-0">
                  {/* On a guest row `profiles` is the PAYER — the guest has no
                      ledger, so the row sits on the payer's (2607-DEV-677).
                      Showing that name unqualified would read as the payer
                      paying twice for themselves. */}
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {p.payment_guests ? (
                      <>
                        {p.payment_guests.name}
                        <span className="text-xs opacity-60 ml-1.5">{t('payment.guestTag')}</span>
                      </>
                    ) : (
                      <>
                        {p.profiles?.first_name} {p.profiles?.last_name}
                        {p.profiles?.abo_number && <span className="font-mono text-xs opacity-60 ml-1.5">{p.profiles.abo_number}</span>}
                      </>
                    )}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {entityLabel} · {formatDate(p.transaction_date)} · {formatCurrency(p.amount, p.currency)}
                    {p.payment_method && ` · ${p.payment_method}`}
                  </p>
                  {/* Without this, a grouped row is indistinguishable from a
                      self-payment and the money looks like it came from the
                      person whose ledger it sits on. */}
                  {p.payment_group_id && p.payer && (
                    <p className="text-xs mt-0.5 italic" style={{ color: 'var(--text-secondary)' }}>
                      {t('payment.paidBy')} {p.payer.first_name} {p.payer.last_name}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:flex-shrink-0">
                  <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: pill.bg, color: pill.color }}>
                    {p.admin_status}
                  </span>
                  <button
                    onClick={() => setDeleteTargetId(p.id)}
                    disabled={isDeleting}
                    className="text-xs px-2 py-1 rounded-lg border transition-colors hover:bg-black/5 disabled:opacity-40"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--brand-crimson)' }}
                    aria-label={t('admin.operations.payments.aria.delete')}
                  >
                    {isDeleting ? '…' : t('admin.operations.payments.btn.delete')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AlertDialog
        open={deleteTargetId !== null}
        onOpenChange={open => { if (!open && !deleteMutation.isPending) setDeleteTargetId(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.operations.payments.dialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.operations.payments.dialog.body')}
            </AlertDialogDescription>
            {/* Deleting one row of a group deletes ALL of them (the route keys
                on payment_group_id), and this dialog is reachable from the full
                payment list — including rows already approved. Naming the count
                and the statuses is the difference between a considered click and
                a surprise. */}
            {deleteGroupScope !== null && (
              <AlertDialogDescription style={{ color: 'var(--brand-crimson)' }}>
                {lang === 'bg'
                  ? `Ще бъдат изтрити ${deleteGroupScope.count} плащания от тази група (${deleteGroupScope.statuses.join(', ')}).`
                  : `${deleteGroupScope.count} payments in this group will be deleted (${deleteGroupScope.statuses.join(', ')}).`}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              {t('admin.operations.payments.dialog.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={e => {
                e.preventDefault()
                if (deleteTargetId !== null) deleteMutation.mutate(deleteTargetId)
              }}
            >
              {deleteMutation.isPending ? '…' : t('admin.operations.payments.dialog.confirm')}
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
