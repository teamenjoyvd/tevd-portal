'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { ITEM_TYPES } from '@/lib/types/items'
import type { PayableItem, ItemFormState } from '@/lib/types/items'

type TripOption = { id: string; title: string }

const CURRENCIES = ['EUR', 'BGN', 'USD']

function itemToForm(item: PayableItem): ItemFormState {
  return {
    title: item.title,
    description: item.description ?? '',
    amount: String(item.amount),
    currency: item.currency,
    item_type: item.item_type,
    linked_trip_id: item.linked_trip_id ?? '',
    is_active: item.is_active,
  }
}

export function ItemMetaForm({ item }: { item: PayableItem }) {
  const [form, setForm] = useState<ItemFormState>(itemToForm(item))
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const { data: trips = [] } = useQuery<TripOption[]>({
    queryKey: ['trips'],
    queryFn: () => fetch('/api/trips').then(r => r.json()),
  })

  async function handleSave() {
    if (isPending) return
    setIsPending(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch(`/api/admin/payable-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
          linked_trip_id: form.linked_trip_id || null,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Failed to save')
      }
      setSaved(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
    >
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Details</h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Title</label>
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2.5 text-sm"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
          />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Type</label>
          <Select
            value={form.item_type}
            onValueChange={val => setForm(f => ({ ...f, item_type: val as ItemFormState['item_type'] }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ITEM_TYPES.map(tp => <SelectItem key={tp} value={tp}>{tp}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Description</label>
        <textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          rows={2}
          className="w-full border rounded-xl px-3 py-2.5 text-sm resize-none"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Amount</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2.5 text-sm"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
          />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Currency</label>
          <Select
            value={form.currency}
            onValueChange={val => setForm(f => ({ ...f, currency: val }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {trips.length > 0 && (
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Linked Trip</label>
          <Select
            value={form.linked_trip_id || 'none'}
            onValueChange={val => setForm(f => ({ ...f, linked_trip_id: val === 'none' ? '' : val }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No trip</SelectItem>
              {trips.map(tr => <SelectItem key={tr.id} value={tr.id}>{tr.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {error && <p className="text-sm" style={{ color: 'var(--brand-crimson)' }}>{error}</p>}
      {saved && <p className="text-sm" style={{ color: '#2d6a4f' }}>Saved.</p>}

      <button
        onClick={handleSave}
        disabled={isPending}
        className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
        style={{ backgroundColor: 'var(--brand-crimson)' }}
      >
        {isPending ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  )
}
