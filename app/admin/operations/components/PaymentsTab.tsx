'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDate, formatCurrency } from '@/lib/format'
import { Drawer } from '@/components/ui/drawer'
import { t } from '@/lib/i18n'
import type { Trip, PayableItem, MembersResponse, MemberProfile } from './operations-types'
import { LogPaymentForm } from './LogPaymentForm'
import { PendingPaymentsSection } from './PendingPaymentsSection'

// ── Types ────────────────────────────────────────────────

type Payment = {
  id: string
  amount: number
  currency: string
  transaction_date: string
  admin_status: string
  member_status: string
  payment_method: string | null
  proof_url: string | null
  note: string | null
  admin_note: string | null
  logged_by_admin: string | null
  created_at: string
  profiles: { first_name: string; last_name: string; abo_number: string | null } | null
  trips: { title: string; destination: string } | null
  payable_items: { title: string; item_type: string; currency: string } | null
}

// Re-export for page.tsx backwards compat (page still imports MembersResponse from here)
export type { MembersResponse } from './operations-types'

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

export function PaymentsTab({ trips, membersData }: { trips: Trip[]; membersData: MembersResponse | undefined }) {
  const qc = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
  const [payError, setPayError] = useState<string | null>(null)

  const { data: items = [] } = useQuery<PayableItem[]>({
    queryKey: ['payable-items'],
    queryFn: () => fetch('/api/admin/payable-items').then(r => r.json()),
  })

  const allMembers: MemberProfile[] = (() => {
    if (!membersData) return []
    const seen = new Set<string>()
    const out: MemberProfile[] = []
    for (const m of membersData.los_members ?? []) {
      if (m.profile && !seen.has(m.profile.id)) {
        seen.add(m.profile.id)
        out.push(m.profile)
      }
    }
    for (const m of membersData.manual_members_no_abo ?? []) {
      if (!seen.has(m.id)) {
        seen.add(m.id)
        out.push({ id: m.id, first_name: m.first_name, last_name: m.last_name, abo_number: null })
      }
    }
    return out.sort((a, b) => a.last_name.localeCompare(b.last_name))
  })()

  const { data: paymentsRaw = [], isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ['admin-payments'],
    queryFn: () => fetch('/api/admin/payments').then(r => r.json()),
    staleTime: 30_000,
  })

  const payments = statusFilter === 'all'
    ? paymentsRaw
    : paymentsRaw.filter(p => p.admin_status === statusFilter)

  const pendingSubmissions = paymentsRaw.filter(
    p => p.admin_status === 'pending' && p.logged_by_admin === null
  )

  const logMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-payments'] })
      setDrawerOpen(false)
      setPayError(null)
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-payments'] }),
  })

  const STATUS_FILTERS = [
    { key: 'all' as const, labelKey: 'admin.operations.payments.filter.all' as const },
    { key: 'pending' as const, labelKey: 'admin.operations.payments.filter.pending' as const },
    { key: 'approved' as const, labelKey: 'admin.operations.payments.filter.approved' as const },
    { key: 'rejected' as const, labelKey: 'admin.operations.payments.filter.rejected' as const },
  ]

  return (
    <section className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setDrawerOpen(true)}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--brand-crimson)' }}
        >
          {t('admin.operations.payments.btn.log', 'en')}
        </button>
      </div>

      <PendingPaymentsSection
        payments={pendingSubmissions}
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

      {paymentsLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }} />)}
        </div>
      ) : payments.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.payments.empty', 'en')}</p>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
          {payments.map((p, i) => {
            const pill = statusPill(p.admin_status)
            const entityLabel = p.trips?.title ?? p.payable_items?.title ?? '—'
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
                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                  style={{ backgroundColor: pill.bg, color: pill.color }}>
                  {p.admin_status}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <Drawer open={drawerOpen} onClose={() => { setDrawerOpen(false); setPayError(null) }} title={t('admin.operations.payments.drawer.title', 'en')}>
        <LogPaymentForm
          trips={trips}
          items={items}
          allMembers={allMembers}
          onSubmit={payload => {
            if (!payload.profile_id) { setDrawerOpen(false); setPayError(null); return }
            logMutation.mutate(payload)
          }}
          isPending={logMutation.isPending}
          externalError={payError}
        />
      </Drawer>
    </section>
  )
}
