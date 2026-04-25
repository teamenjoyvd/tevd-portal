'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDate, formatCurrency } from '@/lib/format'
import { Drawer } from '@/components/ui/drawer'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectGroup,
} from '@/components/ui/select'
import type { Trip } from './TripsTab'
import type { PayableItem } from './ItemsTab'
import { useQuery } from '@tanstack/react-query'
import { t } from '@/lib/i18n'

// ── Types ────────────────────────────────────────────────────────

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

export type MembersResponse = {
  los_members: { profile: { id: string; first_name: string; last_name: string; abo_number: string | null } | null }[]
  manual_members_no_abo: { id: string; first_name: string; last_name: string; upline_abo_number: string | null }[]
}

type MemberProfile = { id: string; first_name: string; last_name: string; abo_number: string | null }

// ── Helpers ──────────────────────────────────────────────────────

function statusPill(status: string) {
  if (status === 'approved' || status === 'completed') {
    return { bg: '#81b29a33', color: '#2d6a4f' }
  }
  if (status === 'rejected' || status === 'denied' || status === 'failed') {
    return { bg: 'rgba(188,71,73,0.1)', color: 'var(--brand-crimson)' }
  }
  return { bg: '#f2cc8f33', color: '#7a5c00' }
}

// ── Component ────────────────────────────────────────────────────

export function PaymentsTab({ trips, membersData }: { trips: Trip[]; membersData: MembersResponse | undefined }) {
  const qc = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})

  const [entity, setEntity] = useState('')
  const [profileId, setProfileId] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0])
  const [method, setMethod] = useState('')
  const [payStatus, setPayStatus] = useState<'approved' | 'pending'>('approved')
  const [note, setNote] = useState('')
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
      setEntity('')
      setProfileId('')
      setAmount('')
      setCurrency('EUR')
      setTxDate(new Date().toISOString().split('T')[0])
      setMethod('')
      setPayStatus('approved')
      setNote('')
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

  function handleLog() {
    if (!entity || !profileId || !amount) return
    const [type, id] = entity.split('::')
    const body: Record<string, unknown> = {
      profile_id: profileId,
      amount: Number(amount),
      currency,
      transaction_date: txDate,
      payment_method: method || null,
      note: note || null,
      admin_status: payStatus,
    }
    if (type === 'trip') body.trip_id = id
    else body.payable_item_id = id
    logMutation.mutate(body)
  }

  const STATUS_FILTERS = [
    { key: 'all' as const, labelKey: 'admin.operations.payments.filter.all' as const },
    { key: 'pending' as const, labelKey: 'admin.operations.payments.filter.pending' as const },
    { key: 'approved' as const, labelKey: 'admin.operations.payments.filter.approved' as const },
    { key: 'rejected' as const, labelKey: 'admin.operations.payments.filter.rejected' as const },
  ]

  const activeItems = items.filter(i => i.is_active)

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

      {pendingSubmissions.length > 0 && (
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>
            {t('admin.operations.payments.pendingTitle', 'en').replace('{{count}}', String(pendingSubmissions.length))}
          </p>
          <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            {pendingSubmissions.map((p, i) => (
              <div key={p.id} className="px-5 py-4 space-y-3"
                style={{ borderTop: i > 0 ? '1px solid var(--border-default)' : 'none' }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {p.profiles?.first_name} {p.profiles?.last_name}
                      {p.profiles?.abo_number && <span className="font-mono font-normal ml-2 text-xs opacity-60">{p.profiles.abo_number}</span>}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {p.trips?.title ?? p.payable_items?.title ?? '—'}
                      {' · '}{formatDate(p.transaction_date)}
                      {' · '}{formatCurrency(p.amount, p.currency)}
                      {p.payment_method && ` · ${p.payment_method}`}
                    </p>
                    {p.note && <p className="text-xs mt-0.5 italic" style={{ color: 'var(--text-secondary)' }}>{p.note}</p>}
                    {p.proof_url && <a href={p.proof_url} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: 'var(--brand-teal)' }}>{t('admin.operations.payments.viewProof', 'en')}</a>}
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#f2cc8f33', color: '#7a5c00' }}>{t('admin.operations.payments.badge.pending', 'en')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    value={reviewNotes[p.id] ?? ''}
                    onChange={e => setReviewNotes(n => ({ ...n, [p.id]: e.target.value }))}
                    placeholder={t('admin.operations.payments.placeholder.adminNote', 'en')}
                    className="flex-1 border rounded-xl px-3 py-2 text-xs"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
                  />
                  <button
                    onClick={() => reviewMutation.mutate({ id: p.id, admin_status: 'approved', admin_note: reviewNotes[p.id] || null })}
                    disabled={reviewMutation.isPending}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
                    style={{ backgroundColor: '#2d6a4f' }}>{t('admin.operations.payments.btn.approve', 'en')}</button>
                  <button
                    onClick={() => reviewMutation.mutate({ id: p.id, admin_status: 'rejected', admin_note: reviewNotes[p.id] || null })}
                    disabled={reviewMutation.isPending}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
                    style={{ backgroundColor: 'var(--brand-crimson)' }}>{t('admin.operations.payments.btn.deny', 'en')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={t('admin.operations.payments.drawer.title', 'en')}>
        <div className="space-y-4">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.payments.lbl.entity', 'en')}</label>
            <Select value={entity} onValueChange={setEntity}>
              <SelectTrigger><SelectValue placeholder={t('admin.operations.payments.placeholder.entity', 'en')} /></SelectTrigger>
              <SelectContent>
                {trips.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>{t('admin.operations.payments.group.trips', 'en')}</SelectLabel>
                    {trips.map(t2 => <SelectItem key={t2.id} value={`trip::${t2.id}`}>{t2.title}</SelectItem>)}
                  </SelectGroup>
                )}
                {trips.length > 0 && activeItems.length > 0 && <SelectSeparator />}
                {activeItems.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>{t('admin.operations.payments.group.items', 'en')}</SelectLabel>
                    {activeItems.map(it => <SelectItem key={it.id} value={`item::${it.id}`}>{it.title}</SelectItem>)}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.payments.lbl.member', 'en')}</label>
            <Select value={profileId} onValueChange={setProfileId}>
              <SelectTrigger><SelectValue placeholder={t('admin.operations.payments.placeholder.member', 'en')} /></SelectTrigger>
              <SelectContent>
                {allMembers.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.last_name}, {m.first_name}{m.abo_number ? ` · ${m.abo_number}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.payments.lbl.amount', 'en')}</label>
              <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00" className="w-full border rounded-xl px-3 py-2.5 text-sm"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.payments.lbl.currency', 'en')}</label>
              <input value={currency} onChange={e => setCurrency(e.target.value)}
                className="w-full border rounded-xl px-3 py-2.5 text-sm"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.payments.lbl.date', 'en')}</label>
              <input type="date" value={txDate} onChange={e => setTxDate(e.target.value)}
                className="w-full border rounded-xl px-3 py-2.5 text-sm"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.payments.lbl.method', 'en')}</label>
              <input value={method} onChange={e => setMethod(e.target.value)}
                placeholder={t('admin.operations.payments.placeholder.method', 'en')}
                className="w-full border rounded-xl px-3 py-2.5 text-sm"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
            </div>
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.payments.lbl.status', 'en')}</label>
            <Select value={payStatus} onValueChange={val => setPayStatus(val as 'approved' | 'pending')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="approved">{t('admin.operations.payments.status.approved', 'en')}</SelectItem>
                <SelectItem value="pending">{t('admin.operations.payments.status.pending', 'en')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
              {t('admin.operations.payments.lbl.note', 'en')} <span className="opacity-60 font-normal">{t('admin.operations.payments.lbl.noteOptional', 'en')}</span>
            </label>
            <input value={note} onChange={e => setNote(e.target.value)}
              placeholder={t('admin.operations.payments.placeholder.note', 'en')}
              className="w-full border rounded-xl px-3 py-2.5 text-sm"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
          </div>
          {payError && <p className="text-sm" style={{ color: 'var(--brand-crimson)' }}>{payError}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={handleLog}
              disabled={logMutation.isPending || !entity || !profileId || !amount || Number(amount) <= 0}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
              style={{ backgroundColor: 'var(--brand-crimson)' }}>
              {logMutation.isPending ? t('admin.operations.payments.btn.saving', 'en') : t('admin.operations.payments.btn.log2', 'en')}
            </button>
            <button onClick={() => setDrawerOpen(false)}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-black/5"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>{t('admin.operations.payments.btn.cancel', 'en')}</button>
          </div>
        </div>
      </Drawer>
    </section>
  )
}
