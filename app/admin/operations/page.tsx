'use client'

import { Suspense } from 'react'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDate, formatCurrency } from '@/lib/format'
import { Drawer } from '@/components/ui/Drawer'

// ── Types ────────────────────────────────────────────────────────

type Milestone = { label: string; amount: number; due_date: string }

type Trip = {
  id: string; title: string; destination: string
  start_date: string; end_date: string
  total_cost: number; milestones: Milestone[]
  currency: string; description: string
  location: string | null; accommodation_type: string | null
  inclusions: string[]; trip_type: string | null
  visibility_roles: string[]
}

type PayableItem = {
  id: string
  title: string
  description: string | null
  amount: number
  currency: string
  item_type: 'trip' | 'book' | 'ticket' | 'merchandise' | 'other'
  linked_trip_id: string | null
  is_active: boolean
  created_at: string
  trips: { title: string } | null
}

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

type MembersResponse = {
  los_members: { profile: { id: string; first_name: string; last_name: string; abo_number: string | null } | null }[]
  manual_members_no_abo: { id: string; first_name: string; last_name: string; upline_abo_number: string | null }[]
}

type MemberProfile = { id: string; first_name: string; last_name: string; abo_number: string | null }

// ── Constants ────────────────────────────────────────────────────

const ALL_ROLES = ['guest', 'member', 'core', 'admin']
const ITEM_TYPES = ['trip', 'book', 'ticket', 'merchandise', 'other'] as const

const TABS = [
  { key: 'trips',    label: 'Trips'    },
  { key: 'items',    label: 'Items'    },
  { key: 'payments', label: 'Payments' },
] as const
type TabKey = typeof TABS[number]['key']

// ── Helpers ──────────────────────────────────────────────────────

const emptyTrip = (): Omit<Trip, 'id' | 'currency'> => ({
  title: '', destination: '', description: '',
  start_date: '', end_date: '', total_cost: 0, milestones: [],
  location: null, accommodation_type: null,
  inclusions: [], trip_type: null,
  visibility_roles: [...ALL_ROLES],
})

type ItemForm = {
  title: string; description: string; amount: string; currency: string
  item_type: 'trip' | 'book' | 'ticket' | 'merchandise' | 'other'
  linked_trip_id: string; is_active: boolean
}
const emptyItem = (): ItemForm => ({
  title: '', description: '', amount: '', currency: 'EUR',
  item_type: 'other', linked_trip_id: '', is_active: true,
})

function statusPill(status: string) {
  if (status === 'approved' || status === 'completed') {
    return { bg: '#81b29a33', color: '#2d6a4f' }
  }
  if (status === 'rejected' || status === 'denied' || status === 'failed') {
    return { bg: 'rgba(188,71,73,0.1)', color: 'var(--brand-crimson)' }
  }
  return { bg: '#f2cc8f33', color: '#7a5c00' } // pending
}

// ── Trips tab ────────────────────────────────────────────────────

function TripsTab({ trips, isLoading }: { trips: Trip[]; isLoading: boolean }) {
  const qc = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Trip | null>(null)
  const [form, setForm] = useState<Omit<Trip, 'id' | 'currency'>>(emptyTrip())
  const [milestoneInput, setMilestoneInput] = useState({ label: '', amount: '', due_date: '' })
  const [error, setError] = useState<string | null>(null)

  function openCreate() {
    setEditing(null)
    setForm(emptyTrip())
    setMilestoneInput({ label: '', amount: '', due_date: '' })
    setError(null)
    setDrawerOpen(true)
  }

  function openEdit(trip: Trip) {
    setEditing(trip)
    setForm({
      title: trip.title,
      destination: trip.destination,
      description: trip.description,
      start_date: trip.start_date,
      end_date: trip.end_date,
      total_cost: trip.total_cost,
      milestones: Array.isArray(trip.milestones) ? trip.milestones : [],
      location: trip.location,
      accommodation_type: trip.accommodation_type,
      inclusions: Array.isArray(trip.inclusions) ? trip.inclusions : [],
      trip_type: trip.trip_type,
      visibility_roles: Array.isArray(trip.visibility_roles) ? trip.visibility_roles : [...ALL_ROLES],
    })
    setMilestoneInput({ label: '', amount: '', due_date: '' })
    setError(null)
    setDrawerOpen(true)
  }

  function addMilestone() {
    if (!milestoneInput.label || !milestoneInput.amount || !milestoneInput.due_date) return
    setForm(f => ({
      ...f,
      milestones: [...f.milestones, {
        label: milestoneInput.label,
        amount: Number(milestoneInput.amount),
        due_date: milestoneInput.due_date,
      }],
    }))
    setMilestoneInput({ label: '', amount: '', due_date: '' })
  }

  const createMutation = useMutation({
    mutationFn: (body: typeof form) =>
      fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trips'] }); setDrawerOpen(false); setError(null) },
    onError: (e: Error) => setError(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: Omit<Trip, 'currency'>) =>
      fetch(`/api/trips/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trips'] }); setDrawerOpen(false); setError(null) },
    onError: (e: Error) => setError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/trips/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trips'] }),
  })

  function handleSave() {
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...form })
    } else {
      createMutation.mutate(form)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const isValid = !!form.title && !!form.destination && !!form.start_date && !!form.end_date

  return (
    <section className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={openCreate}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--brand-crimson)' }}
        >
          + New trip
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }} />)}
        </div>
      ) : trips.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No trips yet.</p>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
          {trips.map((trip, i) => (
            <div key={trip.id} className="px-5 py-4 flex items-center justify-between gap-4"
              style={{ borderTop: i > 0 ? '1px solid var(--border-default)' : 'none' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{trip.title}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {trip.destination} · {formatDate(trip.start_date)} → {formatDate(trip.end_date)}
                  {' · '}{formatCurrency(trip.total_cost, 'EUR')}
                  {' · '}{trip.milestones?.length ?? 0} milestones
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <button onClick={() => openEdit(trip)} className="text-xs hover:opacity-70 transition-opacity" style={{ color: 'var(--text-secondary)' }}>Edit</button>
                <button
                  onClick={() => { if (window.confirm(`Delete "${trip.title}"?`)) deleteMutation.mutate(trip.id) }}
                  className="text-xs hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--brand-crimson)' }}
                >Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editing ? `Edit: ${editing.title}` : 'New trip'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {(['title', 'destination'] as const).map(k => (
              <div key={k}>
                <label className="text-xs mb-1 block capitalize" style={{ color: 'var(--text-secondary)' }}>{k}</label>
                <input
                  value={(form as Record<string, unknown>)[k] as string}
                  onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm"
                  style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }}
                />
              </div>
            ))}
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full border rounded-xl px-3 py-2.5 text-sm resize-none"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Start date</label>
              <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="w-full border rounded-xl px-3 py-2.5 text-sm" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>End date</label>
              <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="w-full border rounded-xl px-3 py-2.5 text-sm" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Cost (EUR)</label>
              <input type="number" value={form.total_cost} onChange={e => setForm(f => ({ ...f, total_cost: Number(e.target.value) }))}
                className="w-full border rounded-xl px-3 py-2.5 text-sm" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }} />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>Payment milestones</p>
            {form.milestones.map((m, i) => (
              <div key={i} className="flex items-center gap-3 text-sm mb-2 py-2 border-b" style={{ borderColor: 'var(--border-default)' }}>
                <span className="flex-1 font-medium" style={{ color: 'var(--text-primary)' }}>{m.label}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{formatCurrency(m.amount, 'EUR')}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{m.due_date}</span>
                <button onClick={() => setForm(f => ({ ...f, milestones: f.milestones.filter((_, idx) => idx !== i) }))}
                  className="text-xs" style={{ color: 'var(--brand-crimson)' }}>Remove</button>
              </div>
            ))}
            <div className="grid grid-cols-4 gap-2 mt-2">
              <input placeholder="Label" value={milestoneInput.label}
                onChange={e => setMilestoneInput(m => ({ ...m, label: e.target.value }))}
                className="border rounded-xl px-3 py-2 text-sm col-span-1" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }} />
              <input placeholder="Amount" type="number" value={milestoneInput.amount}
                onChange={e => setMilestoneInput(m => ({ ...m, amount: e.target.value }))}
                className="border rounded-xl px-3 py-2 text-sm" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }} />
              <input type="date" value={milestoneInput.due_date}
                onChange={e => setMilestoneInput(m => ({ ...m, due_date: e.target.value }))}
                className="border rounded-xl px-3 py-2 text-sm" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }} />
              <button onClick={addMilestone}
                className="border rounded-xl text-sm hover:bg-black/5 transition-colors" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>+ Add</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Location</label>
              <input value={form.location ?? ''} onChange={e => setForm(f => ({ ...f, location: e.target.value || null }))}
                placeholder="e.g. Oradea, Romania" className="w-full border rounded-xl px-3 py-2.5 text-sm"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Trip type</label>
              <input value={form.trip_type ?? ''} onChange={e => setForm(f => ({ ...f, trip_type: e.target.value || null }))}
                placeholder="e.g. leisure, training" className="w-full border rounded-xl px-3 py-2.5 text-sm"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Accommodation</label>
              <input value={form.accommodation_type ?? ''} onChange={e => setForm(f => ({ ...f, accommodation_type: e.target.value || null }))}
                placeholder="e.g. hotel, hostel" className="w-full border rounded-xl px-3 py-2.5 text-sm"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Inclusions (comma-sep)</label>
              <input value={form.inclusions.join(', ')} onChange={e => setForm(f => ({ ...f, inclusions: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                placeholder="e.g. flights, hotel" className="w-full border rounded-xl px-3 py-2.5 text-sm"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }} />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>Visible to</p>
            <div className="flex gap-2 flex-wrap">
              {ALL_ROLES.map(role => (
                <button key={role} onClick={() => setForm(f => ({
                  ...f,
                  visibility_roles: f.visibility_roles.includes(role)
                    ? f.visibility_roles.filter(r => r !== role)
                    : [...f.visibility_roles, role],
                }))}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: form.visibility_roles.includes(role) ? 'var(--brand-forest)' : 'rgba(0,0,0,0.06)',
                    color: form.visibility_roles.includes(role) ? 'var(--brand-parchment)' : 'var(--text-secondary)',
                  }}>
                  {role}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm" style={{ color: 'var(--brand-crimson)' }}>{error}</p>}

          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={isPending || !isValid}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
              style={{ backgroundColor: 'var(--brand-crimson)' }}>
              {isPending ? 'Saving…' : editing ? 'Save changes' : 'Create trip'}
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

// ── Items tab ────────────────────────────────────────────────────

function ItemsTab({ trips }: { trips: Trip[] }) {
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

  type ItemPayload = Omit<ItemForm, 'amount'> & { amount: number }

  function toPayload(f: ItemForm): ItemPayload {
    return { ...f, amount: Number(f.amount) }
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
    if (editing) {
      editMutation.mutate({ id: editing.id, body: toPayload(form) })
    } else {
      createMutation.mutate(toPayload(form))
    }
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
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Type *</label>
              <select value={form.item_type} onChange={e => setForm(f => ({ ...f, item_type: e.target.value as ItemForm['item_type'], linked_trip_id: '' }))}
                className="w-full border rounded-xl px-3 py-2.5 text-sm"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }}>
                {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2} className="w-full border rounded-xl px-3 py-2.5 text-sm resize-none"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Amount *</label>
              <input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full border rounded-xl px-3 py-2.5 text-sm"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Currency</label>
              <input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className="w-full border rounded-xl px-3 py-2.5 text-sm"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }} />
            </div>
          </div>
          {form.item_type === 'trip' && (
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Linked trip</label>
              <select value={form.linked_trip_id} onChange={e => setForm(f => ({ ...f, linked_trip_id: e.target.value }))}
                className="w-full border rounded-xl px-3 py-2.5 text-sm"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }}>
                <option value="">Select trip…</option>
                {trips.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
          )}
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

// ── Payments tab ─────────────────────────────────────────────────

function PaymentsTab({ trips }: { trips: Trip[] }) {
  const qc = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})

  // Drawer form state
  const [entity, setEntity] = useState('') // "trip::{id}" | "item::{id}"
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

  const { data: membersData } = useQuery<MembersResponse>({
    queryKey: ['admin-members'],
    queryFn: () => fetch('/api/admin/members').then(r => r.json()),
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
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ] as const

  const activeItems = items.filter(i => i.is_active)

  return (
    <section className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setDrawerOpen(true)}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--brand-crimson)' }}
        >
          Log Payment
        </button>
      </div>

      {/* Pending member submissions */}
      {pendingSubmissions.length > 0 && (
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>
            Pending submissions ({pendingSubmissions.length})
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
                    {p.proof_url && <a href={p.proof_url} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: 'var(--brand-teal)' }}>View proof ↗</a>}
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#f2cc8f33', color: '#7a5c00' }}>pending</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    value={reviewNotes[p.id] ?? ''}
                    onChange={e => setReviewNotes(n => ({ ...n, [p.id]: e.target.value }))}
                    placeholder="Admin note (optional)"
                    className="flex-1 border rounded-xl px-3 py-2 text-xs"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }}
                  />
                  <button
                    onClick={() => reviewMutation.mutate({ id: p.id, admin_status: 'approved', admin_note: reviewNotes[p.id] || null })}
                    disabled={reviewMutation.isPending}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
                    style={{ backgroundColor: '#2d6a4f' }}>Approve</button>
                  <button
                    onClick={() => reviewMutation.mutate({ id: p.id, admin_status: 'rejected', admin_note: reviewNotes[p.id] || null })}
                    disabled={reviewMutation.isPending}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
                    style={{ backgroundColor: 'var(--brand-crimson)' }}>Deny</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status filter pills */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{
              backgroundColor: statusFilter === f.key ? 'var(--text-primary)' : 'rgba(0,0,0,0.06)',
              color: statusFilter === f.key ? 'var(--bg-card)' : 'var(--text-secondary)',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Payments table */}
      {paymentsLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }} />)}
        </div>
      ) : payments.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No payments found.</p>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
          {payments.map((p, i) => {
            const pill = statusPill(p.admin_status)
            const entity = p.trips?.title ?? p.payable_items?.title ?? '—'
            return (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-4"
                style={{ borderTop: i > 0 ? '1px solid var(--border-default)' : 'none' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {p.profiles?.first_name} {p.profiles?.last_name}
                    {p.profiles?.abo_number && <span className="font-mono text-xs opacity-60 ml-1.5">{p.profiles.abo_number}</span>}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {entity} · {formatDate(p.transaction_date)} · {formatCurrency(p.amount, p.currency)}
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

      {/* Log Payment Drawer */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Log Payment">
        <div className="space-y-4">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Entity *</label>
            <select value={entity} onChange={e => setEntity(e.target.value)}
              className="w-full border rounded-xl px-3 py-2.5 text-sm"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }}>
              <option value="">Select entity…</option>
              {trips.length > 0 && (
                <optgroup label="Trips">
                  {trips.map(t => <option key={t.id} value={`trip::${t.id}`}>{t.title}</option>)}
                </optgroup>
              )}
              {activeItems.length > 0 && (
                <optgroup label="Items">
                  {activeItems.map(it => <option key={it.id} value={`item::${it.id}`}>{it.title}</option>)}
                </optgroup>
              )}
            </select>
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Member *</label>
            <select value={profileId} onChange={e => setProfileId(e.target.value)}
              className="w-full border rounded-xl px-3 py-2.5 text-sm"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }}>
              <option value="">Select member…</option>
              {allMembers.map(m => (
                <option key={m.id} value={m.id}>
                  {m.last_name}, {m.first_name}{m.abo_number ? ` · ${m.abo_number}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Amount *</label>
              <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00" className="w-full border rounded-xl px-3 py-2.5 text-sm"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Currency</label>
              <input value={currency} onChange={e => setCurrency(e.target.value)}
                className="w-full border rounded-xl px-3 py-2.5 text-sm"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Date</label>
              <input type="date" value={txDate} onChange={e => setTxDate(e.target.value)}
                className="w-full border rounded-xl px-3 py-2.5 text-sm"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Payment method</label>
              <input value={method} onChange={e => setMethod(e.target.value)}
                placeholder="e.g. bank transfer, cash"
                className="w-full border rounded-xl px-3 py-2.5 text-sm"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }} />
            </div>
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Status</label>
            <select value={payStatus} onChange={e => setPayStatus(e.target.value as 'approved' | 'pending')}
              className="w-full border rounded-xl px-3 py-2.5 text-sm"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }}>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Note <span className="opacity-60 font-normal">(optional)</span></label>
            <input value={note} onChange={e => setNote(e.target.value)}
              placeholder="e.g. Cash payment, ref #123"
              className="w-full border rounded-xl px-3 py-2.5 text-sm"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }} />
          </div>

          {payError && <p className="text-sm" style={{ color: 'var(--brand-crimson)' }}>{payError}</p>}

          <div className="flex gap-3 pt-2">
            <button onClick={handleLog}
              disabled={logMutation.isPending || !entity || !profileId || !amount || Number(amount) <= 0}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
              style={{ backgroundColor: 'var(--brand-crimson)' }}>
              {logMutation.isPending ? 'Saving…' : 'Log payment'}
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

// ── Main page ─────────────────────────────────────────────────────

function OperationsInner() {
  const searchParams = useSearchParams()
  const tab = (searchParams.get('tab') ?? 'trips') as TabKey

  const { data: trips = [], isLoading: tripsLoading } = useQuery<Trip[]>({
    queryKey: ['trips'],
    queryFn: () => fetch('/api/trips').then(r => r.json()),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Operations
        </h1>
      </div>

      {/* Tabs */}
      <div>
        <div className="flex gap-1 border-b mb-6" style={{ borderColor: 'var(--border-default)' }}>
          {TABS.map(t => (
            <Link
              key={t.key}
              href={`/admin/operations?tab=${t.key}`}
              scroll={false}
              className="px-4 py-2.5 text-sm font-semibold transition-colors relative"
              style={{
                color: tab === t.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderBottom: tab === t.key ? '2px solid var(--brand-crimson)' : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {tab === 'trips' && <TripsTab trips={trips} isLoading={tripsLoading} />}
        {tab === 'items' && <ItemsTab trips={trips} />}
        {tab === 'payments' && <PaymentsTab trips={trips} />}
      </div>
    </div>
  )
}

export default function OperationsPage() {
  return (
    <Suspense>
      <OperationsInner />
    </Suspense>
  )
}
