'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatCurrency } from '@/lib/format'
import { Drawer } from '@/components/ui/drawer'
import { ItemForm } from './ItemForm'
import type { Trip, PayableItem, ItemFormState } from './operations-types'
import { t } from '@/lib/i18n'

// Re-export for backwards compat (PaymentsTab imports PayableItem from here historically)
export type { PayableItem } from './operations-types'

// ── Helpers ──────────────────────────────────────────────

const emptyItem = (): ItemFormState => ({
  title: '', description: '', amount: '', currency: 'EUR',
  item_type: 'other', linked_trip_id: '', is_active: true,
})

// ── Component ────────────────────────────────────────────

export function ItemsTab({ trips }: { trips: Trip[] }) {
  const qc = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<PayableItem | null>(null)
  const [form, setForm] = useState<ItemFormState>(emptyItem())
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

  type ItemPayload = Omit<ItemFormState, 'amount' | 'linked_trip_id'> & { amount: number; linked_trip_id: string | null }

  function toPayload(f: ItemFormState): ItemPayload {
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
          {t('admin.operations.items.btn.new', 'en')}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }} />)}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.items.empty', 'en')}</p>
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
                    {item.is_active ? t('admin.operations.items.badge.active', 'en') : t('admin.operations.items.badge.inactive', 'en')}
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
                <button onClick={() => openEdit(item)} className="text-xs hover:opacity-70 transition-opacity" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.items.btn.edit', 'en')}</button>
                {item.is_active && (
                  <button
                    onClick={() => deactivateMutation.mutate(item.id)}
                    disabled={deactivateMutation.isPending}
                    className="text-xs hover:opacity-70 transition-opacity disabled:opacity-40"
                    style={{ color: 'var(--brand-crimson)' }}
                  >{t('admin.operations.items.btn.deactivate', 'en')}</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editing ? t('admin.operations.items.title.edit', 'en').replace('{{title}}', editing.title) : t('admin.operations.items.btn.create', 'en')}>
        <ItemForm
          form={form}
          setForm={setForm}
          trips={trips}
          error={error}
          isPending={isPending}
          isValid={isValid}
          editing={editing}
          onSave={handleSave}
          onClose={() => setDrawerOpen(false)}
        />
      </Drawer>
    </section>
  )
}
