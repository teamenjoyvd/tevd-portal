'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { ITEM_TYPES } from '@/lib/types/items'
import type { ItemFormState } from '@/lib/types/items'

type TripOption = { id: string; title: string }

const CURRENCIES = ['EUR', 'BGN', 'USD']

function emptyForm(): ItemFormState {
  return {
    title: '',
    description: '',
    amount: '',
    currency: 'EUR',
    item_type: 'other',
    linked_trip_id: '',
    is_active: true,
  }
}

export function ItemCreateForm() {
  const router = useRouter()
  const [form, setForm] = useState<ItemFormState>(emptyForm())
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: trips = [] } = useQuery<TripOption[]>({
    queryKey: ['trips'],
    queryFn: async () => {
      const res = await fetch('/api/trips')
      if (!res.ok) throw new Error('Failed to fetch trips')
      return res.json()
    },
  })

  const isValid = !!form.title.trim() && !!form.amount

  async function handleSubmit() {
    if (!isValid || isPending) return
    setIsPending(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/payable-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
          linked_trip_id: form.linked_trip_id || null,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Failed to create item')
      }
      const data = await res.json()
      router.push(`/admin/items/${data.id}`)
    } catch (e) {
      setError((e as Error).message)
      setIsPending(false)
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      {/* Title + Type */}
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
              {ITEM_TYPES.map(tp => (
                <SelectItem key={tp} value={tp}>{tp}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Description */}
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

      {/* Amount + Currency */}
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

      {/* Linked trip */}
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

      {/* Active toggle */}
      <div>
        <button
          onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
          className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
          style={{
            backgroundColor: form.is_active ? 'var(--brand-forest)' : 'rgba(0,0,0,0.06)',
            color: form.is_active ? 'var(--brand-parchment)' : 'var(--text-secondary)',
          }}
        >
          {form.is_active ? 'Active' : 'Inactive'}
        </button>
      </div>

      {error && <p className="text-sm" style={{ color: 'var(--brand-crimson)' }}>{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          onClick={handleSubmit}
          disabled={isPending || !isValid}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--brand-crimson)' }}
        >
          {isPending ? 'Creating…' : 'Create Item'}
        </button>
      </div>
    </div>
  )
}
