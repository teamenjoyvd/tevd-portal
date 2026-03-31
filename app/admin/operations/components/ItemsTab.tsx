'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatCurrency } from '@/lib/format'
import { Drawer } from '@/components/ui/Drawer'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import type { Trip } from './TripsTab'

// ── Types ────────────────────────────────────────────────────────

export type PayableItem = {
  id: string
  title: string
  description: string | null
  amount: number
  currency: string
  item_type: 'merchandise' | 'ticket' | 'food' | 'book' | 'other'
  linked_trip_id: string | null
  is_active: boolean
  created_at: string
  trips: { title: string } | null
}

type ItemForm = {
  title: string; description: string; amount: string; currency: string
  item_type: 'merchandise' | 'ticket' | 'food' | 'book' | 'other'
  linked_trip_id: string; is_active: boolean
}

// ── Constants ────────────────────────────────────────────────────

const ITEM_TYPES = ['merchandise', 'ticket', 'food', 'book', 'other'] as const

// ── Helpers ──────────────────────────────────────────────────────

const emptyItem = (): ItemForm => ({
  title: '', description: '', amount: '', currency: 'EUR',
  item_type: 'other', linked_trip_id: '', is_active: true,
})

// ── Component ────────────────────────────────────────────────────

export function ItemsTab({ trips }: { trips: Trip[] }) {
  const qc = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<PayableItem | null>(null)
  const [form, setForm] = useState<ItemForm>(emptyItem())
  const [error, setError] = useState<string | null>(null)

  const { data: items = [], isLoading } = useQuery<PayableItem[]>({
    queryKey: ['payable-items'],
    queryFn: () => fetch('/api/admin/payable-items').then(r => r.json()),
  })

  function openCreate() {
    setEditing(null)
    setForm(emptyItem())
    setError(null)
    setDrawerOpen(true)
  }

  function openEdit(item: PayableItem) {
    setEditing(item)
    setForm({
      title: item.title,
      description: item.description ?? '',
      amount: String(item.amount),
      currency: item.currency,
      item_type: item.item_type,
      linked_trip_id: item.linked_trip_id ?? '',
      is_active: item.is_active,
    })
    setError(null)
    setDrawerOpen(true)
  }

  type ItemPayload = Omit<ItemForm, 'amount' | 'linked_trip_id'> & { amount: number; linked_trip_id: string | null }

  function toPayload(f: ItemForm): ItemPayload {
    return { ...f, amount: Number(f.amount), linked_trip_id: f.linked_trip_id || null }
  }

  const createMutation = useMutation({
    mutationFn: (body: ItemPayload) =>
      fetch('/api/admin/payable-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payable-items'] }); setDrawerOpen(false); setError(null) },
    onError: (e: Error) => setError(e.message),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ItemPayload }) =>
      fetch(`/api/admin/payable-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payable-items'] }); setDrawerOpen(false); setError(null) },
    onError: (e: Error) => setError(e.message),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/payable-items/${id}`, { method: 'DELETE' }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error); return r.json()
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payable-items'] }),
  })

  function handleSave() {
    if (editing) editMutation.mutate({ id: editing.id, body: toPayload(form) })
    else createMutation.mutate(toPayload(form))
  }

  const isPending = createMutation.isPending || editMutation.isPending
  const isValid = !!form.title && !!form.amount

  return (
    <section className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={openCreate}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--brand-crimson)' }}
        >
          + New item
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }} />)}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No payable items yet.</p>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
          {items.map((item, i) => (
            <div key={item.id} className="px-5 py-4 flex items-center justify-between gap-4"
              style={{ borderTop: i > 0 ? '1px solid var(--border-default)' : 'none' }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: item.is_active ? '#81b29a33' : 'rgba(0,0,0,0.06)', color: item.is_active ? '#2d6a4f' : 'var(--text-secondary)' }}>
                    {item.is_active ? 'active' : 'inactive'}
                  </span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}>
                    {item.item_type}
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {formatCurrency(item.amount, item.currency)}
                  {item.trips && ` · ${item.trips.title}`}
                  {item.description && ` · ${item.description}`}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <button onClick={() => openEdit(item)} className="text-xs hover:opacity-70 transition-opacity" style={{ color: 'var(--text-secondary)' }}>Edit</button>
                {item.is_active && (
                  <button
                    onClick={() => deactivateMutation.mutate(item.id)}
                    disabled={deactivateMutation.isPending}
                    className="text-xs hover:opacity-70 transition-opacity disabled:opacity-40"
                    style={{ color: 'var(--brand-crimson)' }}
                  >Deactivate</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editing ? `Edit: ${editing.title}` : 'New payable item'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full border rounded-xl px-3 py-2.5 text-sm"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Type *</label>
              <Select
                value={form.item_type}
                onValueChange={val => setForm(f => ({ ...f, item_type: val as ItemForm['item_type'] }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ITEM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2} className="w-full border rounded-xl px-3 py-2.5 text-sm resize-none"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Amount *</label>
              <input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full border rounded-xl px-3 py-2.5 text-sm"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Currency</label>
              <input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className="w-full border rounded-xl px-3 py-2.5 text-sm"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
            </div>
          </div>
          <div>
            <button onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
              className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
              style={{ backgroundColor: form.is_active ? 'var(--brand-forest)' : 'rgba(0,0,0,0.06)', color: form.is_active ? 'var(--brand-parchment)' : 'var(--text-secondary)' }}>
              {form.is_active ? 'Active' : 'Inactive'}
            </button>
          </div>
          {error && <p className="text-sm" style={{ color: 'var(--brand-crimson)' }}>{error}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={isPending || !isValid}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
              style={{ backgroundColor: 'var(--brand-crimson)' }}>
              {isPending ? 'Saving…' : editing ? 'Save changes' : 'Create item'}
            </button>
            <button onClick={() => setDrawerOpen(false)}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-black/5"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>Cancel</button>
          </div>
        </div>
      </Drawer>
    </section>
  )
}
