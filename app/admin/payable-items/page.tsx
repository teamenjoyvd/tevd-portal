'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatCurrency } from '@/lib/format'

type Trip = { id: string; title: string }

type PayableItem = {
  id: string
  title: string
  description: string | null
  amount: number
  currency: string
  item_type: 'trip' | 'book' | 'ticket' | 'other'
  linked_trip_id: string | null
  is_active: boolean
  created_at: string
  trips: { title: string } | null
}

type Payment = {
  id: string
  amount: number
  transaction_date: string
  status: string
  payment_method: string | null
  proof_url: string | null
  note: string | null
  admin_note: string | null
  submitted_by_member: boolean
  created_at: string
  profiles: { first_name: string; last_name: string; abo_number: string | null } | null
  payable_items: { title: string; item_type: string; currency: string } | null
}

const ITEM_TYPES = ['trip', 'book', 'ticket', 'other'] as const

type ItemForm = {
  title: string
  description: string
  amount: string
  currency: string
  item_type: 'trip' | 'book' | 'ticket' | 'other'
  linked_trip_id: string
  is_active: boolean
}

type ItemPayload = Omit<ItemForm, 'amount'> & { amount: number }

const emptyForm = (): ItemForm => ({
  title: '',
  description: '',
  amount: '',
  currency: 'EUR',
  item_type: 'other',
  linked_trip_id: '',
  is_active: true,
})

export default function PayableItemsPage() {
  const qc = useQueryClient()

  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState<ItemForm>(emptyForm())
  const [createError, setCreateError] = useState<string | null>(null)

  const [editing, setEditing] = useState<PayableItem | null>(null)
  const [editForm, setEditForm] = useState<ItemForm>(emptyForm())
  const [editError, setEditError] = useState<string | null>(null)

  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({})

  const { data: items = [], isLoading } = useQuery<PayableItem[]>({
    queryKey: ['payable-items'],
    queryFn: () => fetch('/api/admin/payable-items').then(r => r.json()),
  })

  const { data: trips = [] } = useQuery<Trip[]>({
    queryKey: ['trips'],
    queryFn: () => fetch('/api/trips').then(r => r.json()),
  })

  const { data: pendingPayments = [] } = useQuery<Payment[]>({
    queryKey: ['payments-generic', 'pending'],
    queryFn: () => fetch('/api/admin/payments-generic?status=pending').then(r => r.json()),
    staleTime: 30_000,
  })

  const createMutation = useMutation({
    mutationFn: (body: ItemPayload) =>
      fetch('/api/admin/payable-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payable-items'] })
      setCreating(false)
      setCreateForm(emptyForm())
      setCreateError(null)
    },
    onError: (e: Error) => setCreateError(e.message),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ItemPayload }) =>
      fetch(`/api/admin/payable-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payable-items'] })
      setEditing(null)
      setEditError(null)
    },
    onError: (e: Error) => setEditError(e.message),
  })

  const softDeleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/payable-items/${id}`, { method: 'DELETE' }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payable-items'] }),
  })

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, admin_note }: { id: string; status: 'approved' | 'denied'; admin_note: string | null }) =>
      fetch(`/api/admin/payments-generic/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_note }),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments-generic', 'pending'] })
    },
  })

  function startEditing(item: PayableItem) {
    setEditForm({
      title: item.title,
      description: item.description ?? '',
      amount: String(item.amount),
      currency: item.currency,
      item_type: item.item_type,
      linked_trip_id: item.linked_trip_id ?? '',
      is_active: item.is_active,
    })
    setEditError(null)
    setEditing(item)
  }

  function toPayload(form: ItemForm): ItemPayload {
    return {
      title: form.title,
      description: form.description,
      amount: Number(form.amount),
      currency: form.currency,
      item_type: form.item_type,
      linked_trip_id: form.linked_trip_id,
      is_active: form.is_active,
    }
  }

  function submitCreate() {
    if (!createForm.title || !createForm.amount || !createForm.item_type) return
    createMutation.mutate(toPayload(createForm))
  }

  function submitEdit() {
    if (!editing) return
    editMutation.mutate({ id: editing.id, body: toPayload(editForm) })
  }

  const paymentsForItem = (itemId: string) =>
    pendingPayments.filter(p => p.payable_items != null && items.find(i => i.id === itemId)?.title === p.payable_items?.title)

  return (
    <div className="space-y-10">

      {/* ── Header ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              Payable Items
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Define items members can submit payments against.
            </p>
          </div>
          <button
            onClick={() => { setCreating(c => !c); setCreateError(null) }}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--brand-crimson)' }}
          >
            {creating ? 'Cancel' : '+ New item'}
          </button>
        </div>

        {/* Create form */}
        {creating && (
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-6 mb-6">
            <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: 'var(--text-secondary)' }}>
              New payable item
            </p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Title *</label>
                <input
                  value={createForm.title}
                  onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Type *</label>
                <select
                  value={createForm.item_type}
                  onChange={e => setCreateForm(f => ({ ...f, item_type: e.target.value as ItemForm['item_type'], linked_trip_id: '' }))}
                  className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm bg-white"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="mb-4">
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Description</label>
              <textarea
                value={createForm.description}
                onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm resize-none"
                style={{ color: 'var(--text-primary)' }}
              />
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Amount *</label>
                <input
                  type="number" step="0.01" min="0"
                  value={createForm.amount}
                  onChange={e => setCreateForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Currency</label>
                <input
                  value={createForm.currency}
                  onChange={e => setCreateForm(f => ({ ...f, currency: e.target.value }))}
                  className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>
              {createForm.item_type === 'trip' && (
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Trip</label>
                  <select
                    value={createForm.linked_trip_id}
                    onChange={e => setCreateForm(f => ({ ...f, linked_trip_id: e.target.value }))}
                    className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm bg-white"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <option value="">Select trip…</option>
                    {trips.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 mb-5">
              <button
                onClick={() => setCreateForm(f => ({ ...f, is_active: !f.is_active }))}
                className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
                style={{
                  backgroundColor: createForm.is_active ? 'var(--brand-forest)' : 'rgba(0,0,0,0.06)',
                  color: createForm.is_active ? 'var(--brand-parchment)' : 'var(--text-secondary)',
                }}
              >
                {createForm.is_active ? 'Active' : 'Inactive'}
              </button>
            </div>
            {createError && <p className="text-sm mb-3" style={{ color: 'var(--brand-crimson)' }}>{createError}</p>}
            <button
              onClick={submitCreate}
              disabled={createMutation.isPending || !createForm.title || !createForm.amount}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
              style={{ backgroundColor: 'var(--brand-crimson)' }}
            >
              {createMutation.isPending ? 'Creating…' : 'Create item'}
            </button>
          </div>
        )}
      </section>

      {/* ── Items list ── */}
      <section>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No payable items yet.</p>
        ) : (
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
            {items.map((item, i) => {
              const itemPayments = paymentsForItem(item.id)
              const isExpanded = expandedItem === item.id
              return (
                <div key={item.id} style={{ borderTop: i > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                  <div className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: item.is_active ? '#81b29a33' : 'rgba(0,0,0,0.06)',
                            color: item.is_active ? '#2d6a4f' : 'var(--text-secondary)',
                          }}
                        >
                          {item.is_active ? 'active' : 'inactive'}
                        </span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}>
                          {item.item_type}
                        </span>
                        {itemPayments.length > 0 && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#f2cc8f33', color: '#7a5c00' }}>
                            {itemPayments.length} pending
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {formatCurrency(item.amount, item.currency)}
                        {item.trips && ` · ${item.trips.title}`}
                        {item.description && ` · ${item.description}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {itemPayments.length > 0 && (
                        <button
                          onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                          className="text-xs hover:opacity-70 transition-opacity"
                          style={{ color: 'var(--brand-teal)' }}
                        >
                          {isExpanded ? 'Hide' : 'Review'}
                        </button>
                      )}
                      <button
                        onClick={() => startEditing(item)}
                        className="text-xs hover:opacity-70 transition-opacity"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        Edit
                      </button>
                      {item.is_active && (
                        <button
                          onClick={() => softDeleteMutation.mutate(item.id)}
                          disabled={softDeleteMutation.isPending}
                          className="text-xs hover:opacity-70 transition-opacity disabled:opacity-40"
                          style={{ color: 'var(--brand-crimson)' }}
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ── Pending payments for this item ── */}
                  {isExpanded && itemPayments.length > 0 && (
                    <div className="border-t border-black/5" style={{ backgroundColor: 'rgba(0,0,0,0.02)' }}>
                      {itemPayments.map((p, pi) => (
                        <div
                          key={p.id}
                          className="px-5 py-4 space-y-3"
                          style={{ borderTop: pi > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                {p.profiles?.first_name} {p.profiles?.last_name}
                                {p.profiles?.abo_number && (
                                  <span className="font-mono font-normal ml-2 text-xs opacity-60">{p.profiles.abo_number}</span>
                                )}
                              </p>
                              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                {formatCurrency(p.amount, p.payable_items?.currency ?? 'EUR')}
                                {p.payment_method && ` · ${p.payment_method}`}
                                {p.note && ` · ${p.note}`}
                              </p>
                              {p.proof_url && (
                                <a
                                  href={p.proof_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs hover:underline"
                                  style={{ color: 'var(--brand-teal)' }}
                                >
                                  View proof ↗
                                </a>
                              )}
                            </div>
                            <span
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: '#f2cc8f33', color: '#7a5c00' }}
                            >
                              pending
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              value={adminNotes[p.id] ?? ''}
                              onChange={e => setAdminNotes(n => ({ ...n, [p.id]: e.target.value }))}
                              placeholder="Admin note (optional)"
                              className="flex-1 border border-black/10 rounded-xl px-3 py-2 text-xs"
                              style={{ color: 'var(--text-primary)' }}
                            />
                            <button
                              onClick={() => reviewMutation.mutate({ id: p.id, status: 'approved', admin_note: adminNotes[p.id] || null })}
                              disabled={reviewMutation.isPending}
                              className="px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
                              style={{ backgroundColor: '#2d6a4f' }}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => reviewMutation.mutate({ id: p.id, status: 'denied', admin_note: adminNotes[p.id] || null })}
                              disabled={reviewMutation.isPending}
                              className="px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
                              style={{ backgroundColor: 'var(--brand-crimson)' }}
                            >
                              Deny
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Edit item ── */}
      {editing && (
        <section>
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>
                Edit: {editing.title}
              </p>
              <button
                onClick={() => setEditing(null)}
                className="text-xs hover:opacity-70 transition-opacity"
                style={{ color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Title *</label>
                <input
                  value={editForm.title}
                  onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Type *</label>
                <select
                  value={editForm.item_type}
                  onChange={e => setEditForm(f => ({ ...f, item_type: e.target.value as ItemForm['item_type'], linked_trip_id: '' }))}
                  className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm bg-white"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="mb-4">
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Description</label>
              <textarea
                value={editForm.description}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm resize-none"
                style={{ color: 'var(--text-primary)' }}
              />
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Amount *</label>
                <input
                  type="number" step="0.01" min="0"
                  value={editForm.amount}
                  onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Currency</label>
                <input
                  value={editForm.currency}
                  onChange={e => setEditForm(f => ({ ...f, currency: e.target.value }))}
                  className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>
              {editForm.item_type === 'trip' && (
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Trip</label>
                  <select
                    value={editForm.linked_trip_id}
                    onChange={e => setEditForm(f => ({ ...f, linked_trip_id: e.target.value }))}
                    className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm bg-white"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <option value="">Select trip…</option>
                    {trips.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 mb-5">
              <button
                onClick={() => setEditForm(f => ({ ...f, is_active: !f.is_active }))}
                className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
                style={{
                  backgroundColor: editForm.is_active ? 'var(--brand-forest)' : 'rgba(0,0,0,0.06)',
                  color: editForm.is_active ? 'var(--brand-parchment)' : 'var(--text-secondary)',
                }}
              >
                {editForm.is_active ? 'Active' : 'Inactive'}
              </button>
            </div>
            {editError && <p className="text-sm mb-3" style={{ color: 'var(--brand-crimson)' }}>{editError}</p>}
            <div className="flex gap-3">
              <button
                onClick={submitEdit}
                disabled={editMutation.isPending || !editForm.title || !editForm.amount}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: 'var(--brand-crimson)' }}
              >
                {editMutation.isPending ? 'Saving…' : 'Save changes'}
              </button>
              <button
                onClick={() => setEditing(null)}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-black/5"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </section>
      )}

    </div>
  )
}
