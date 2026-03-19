'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDate, formatCurrency } from '@/lib/format'

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

type Profile = {
  id: string; first_name: string; last_name: string; abo_number: string | null
}

type Registration = {
  id: string; profile_id: string; status: string
  profile: { id: string; first_name: string; last_name: string; abo_number: string | null }
}

type Payment = {
  id: string; amount: number; transaction_date: string
  status: string; note: string | null
  profile: { first_name: string; last_name: string }
}

type PendingSubmission = {
  id: string
  amount: number
  transaction_date: string
  status: string
  payment_method: string | null
  proof_url: string | null
  note: string | null
  submitted_by_member: boolean
  created_at: string
  profiles: { first_name: string; last_name: string; abo_number: string | null } | null
  trips: { title: string; destination: string } | null
}

const ALL_ROLES = ['guest', 'member', 'core', 'admin']

const empty = (): Omit<Trip, 'id' | 'currency'> => ({
  title: '', destination: '', description: '',
  start_date: '', end_date: '', total_cost: 0, milestones: [],
  location: null, accommodation_type: null,
  inclusions: [], trip_type: null,
  visibility_roles: [...ALL_ROLES],
})

export default function OperationsPage() {
  const qc = useQueryClient()

  // ── Trip creation state ──
  const [form, setForm] = useState(empty())
  const [milestoneInput, setMilestoneInput] = useState({ label: '', amount: '', due_date: '' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // ── Trip editing state ──
  const [editing, setEditing] = useState<Trip | null>(null)
  const [editForm, setEditForm] = useState<Omit<Trip, 'id' | 'currency'>>(empty())
  const [editMilestoneInput, setEditMilestoneInput] = useState({ label: '', amount: '', due_date: '' })
  const [editError, setEditError] = useState<string | null>(null)

  // ── Payment entry state ──
  const [selectedTripId, setSelectedTripId] = useState<string>('')
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')
  const [paymentAmount, setPaymentAmount] = useState<string>('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentNote, setPaymentNote] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<'completed' | 'pending' | 'failed'>('completed')
  const [paymentError, setPaymentError] = useState<string | null>(null)

  // ── Submission review state ──
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})

  // ── Queries ──
  const { data: trips = [], isLoading } = useQuery<Trip[]>({
    queryKey: ['trips'],
    queryFn: () => fetch('/api/trips').then(r => r.json()),
  })

  const { data: registrations = [] } = useQuery<Registration[]>({
    queryKey: ['registrations', 'trip', selectedTripId],
    queryFn: () => fetch(`/api/trips/${selectedTripId}/registrations`).then(r => r.json()),
    enabled: !!selectedTripId,
  })

  const { data: tripPayments = [] } = useQuery<Payment[]>({
    queryKey: ['trip-payments', selectedTripId],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${selectedTripId}/payments`)
      const data = await res.json()
      return data
    },
    enabled: !!selectedTripId,
  })

  const { data: pendingSubmissions = [] } = useQuery<PendingSubmission[]>({
    queryKey: ['admin-payment-submissions'],
    queryFn: () => fetch('/api/admin/payments').then(r => r.json()),
    staleTime: 30 * 1000,
  })

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (body: typeof form) =>
      fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trips'] })
      setForm(empty())
      setCreating(false)
      setCreateError(null)
    },
    onError: (e: Error) => setCreateError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/trips/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trips'] }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: Omit<Trip, 'currency'>) =>
      fetch(`/api/trips/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trips'] })
      setEditing(null)
      setEditError(null)
    },
    onError: (e: Error) => setEditError(e.message),
  })

  const paymentMutation = useMutation({
    mutationFn: (body: {
      trip_id: string; profile_id: string; amount: number
      transaction_date: string; status: string; note: string | null
    }) =>
      fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trip-payments', selectedTripId] })
      qc.invalidateQueries({ queryKey: ['payments'] })
      setPaymentAmount('')
      setPaymentNote('')
      setPaymentError(null)
    },
    onError: (e: Error) => setPaymentError(e.message),
  })

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: 'completed' | 'failed'; note: string | null }) =>
      fetch(`/api/admin/payments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note }),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-payment-submissions'] })
    },
  })

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

  function removeMilestone(i: number) {
    setForm(f => ({ ...f, milestones: f.milestones.filter((_, idx) => idx !== i) }))
  }

  function addEditMilestone() {
    if (!editMilestoneInput.label || !editMilestoneInput.amount || !editMilestoneInput.due_date) return
    setEditForm(f => ({
      ...f,
      milestones: [...f.milestones, {
        label: editMilestoneInput.label,
        amount: Number(editMilestoneInput.amount),
        due_date: editMilestoneInput.due_date,
      }],
    }))
    setEditMilestoneInput({ label: '', amount: '', due_date: '' })
  }

  function removeEditMilestone(i: number) {
    setEditForm(f => ({ ...f, milestones: f.milestones.filter((_, idx) => idx !== i) }))
  }

  function startEditing(trip: Trip) {
    setEditForm({
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
    setEditMilestoneInput({ label: '', amount: '', due_date: '' })
    setEditError(null)
    setEditing(trip)
  }

  function submitPayment() {
    if (!selectedTripId || !selectedProfileId || !paymentAmount) return
    paymentMutation.mutate({
      trip_id: selectedTripId,
      profile_id: selectedProfileId,
      amount: Number(paymentAmount),
      transaction_date: paymentDate,
      status: paymentStatus,
      note: paymentNote || null,
    })
  }

  const approvedRegistrations = registrations.filter(r => r.status === 'approved')
  const selectedTrip = trips.find(t => t.id === selectedTripId)

  // suppress unused variable warning
  void Profile

  return (
    <div className="space-y-10">

      {/* ── Trip creation ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              Operations
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Manage trips, milestones, and member payments.
            </p>
          </div>
          <button
            onClick={() => setCreating(c => !c)}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--brand-crimson)' }}
          >
            {creating ? 'Cancel' : '+ New trip'}
          </button>
        </div>

        {/* Create form */}
        {creating && (
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-6 mb-6">
            <p className="text-xs font-semibold tracking-widest uppercase mb-4"
              style={{ color: 'var(--text-secondary)' }}>
              New trip
            </p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              {(['title', 'destination'] as const).map(k => (
                <div key={k}>
                  <label className="text-xs mb-1 block capitalize" style={{ color: 'var(--text-secondary)' }}>
                    {k}
                  </label>
                  <input
                    value={(form as Record<string, unknown>)[k] as string}
                    onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                    className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                    style={{ color: 'var(--text-primary)' }}
                  />
                </div>
              ))}
            </div>
            <div className="mb-4">
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                Description
              </label>
              <textarea
                value={(form as Record<string, unknown>).description as string}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm resize-none"
                style={{ color: 'var(--text-primary)' }}
              />
            </div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Start date</label>
                <input type="date" value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                  style={{ color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>End date</label>
                <input type="date" value={form.end_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                  className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                  style={{ color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Total cost (EUR)</label>
                <input type="number" value={form.total_cost}
                  onChange={e => setForm(f => ({ ...f, total_cost: Number(e.target.value) }))}
                  className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                  style={{ color: 'var(--text-primary)' }} />
              </div>
            </div>

            <div className="mb-6">
              <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>Payment milestones</p>
              {form.milestones.map((m, i) => (
                <div key={i} className="flex items-center gap-3 text-sm mb-2 py-2 border-b border-black/5">
                  <span className="flex-1 font-medium" style={{ color: 'var(--text-primary)' }}>{m.label}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{formatCurrency(m.amount, 'EUR')}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{m.due_date}</span>
                  <button onClick={() => removeMilestone(i)} className="text-xs" style={{ color: 'var(--brand-crimson)' }}>Remove</button>
                </div>
              ))}
              <div className="grid grid-cols-4 gap-2 mt-3">
                <input placeholder="Label" value={milestoneInput.label}
                  onChange={e => setMilestoneInput(m => ({ ...m, label: e.target.value }))}
                  className="border border-black/10 rounded-xl px-3 py-2 text-sm col-span-1" style={{ color: 'var(--text-primary)' }} />
                <input placeholder="Amount" type="number" value={milestoneInput.amount}
                  onChange={e => setMilestoneInput(m => ({ ...m, amount: e.target.value }))}
                  className="border border-black/10 rounded-xl px-3 py-2 text-sm" style={{ color: 'var(--text-primary)' }} />
                <input type="date" value={milestoneInput.due_date}
                  onChange={e => setMilestoneInput(m => ({ ...m, due_date: e.target.value }))}
                  className="border border-black/10 rounded-xl px-3 py-2 text-sm" style={{ color: 'var(--text-primary)' }} />
                <button onClick={addMilestone}
                  className="border border-black/10 rounded-xl text-sm hover:bg-black/[0.02] transition-colors" style={{ color: 'var(--text-primary)' }}>+ Add</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Location</label>
                <input value={form.location ?? ''} onChange={e => setForm(f => ({ ...f, location: e.target.value || null }))}
                  placeholder="e.g. Oradea, Romania" className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm" style={{ color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Trip type</label>
                <input value={form.trip_type ?? ''} onChange={e => setForm(f => ({ ...f, trip_type: e.target.value || null }))}
                  placeholder="e.g. leisure, training, business" className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm" style={{ color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Accommodation type</label>
                <input value={form.accommodation_type ?? ''} onChange={e => setForm(f => ({ ...f, accommodation_type: e.target.value || null }))}
                  placeholder="e.g. hotel, hostel, apartment" className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm" style={{ color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Inclusions (comma-separated)</label>
                <input value={form.inclusions.join(', ')} onChange={e => setForm(f => ({ ...f, inclusions: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                  placeholder="e.g. flights, hotel, breakfast" className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm" style={{ color: 'var(--text-primary)' }} />
              </div>
            </div>

            <div className="mb-6">
              <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>Visible to</p>
              <div className="flex gap-2">
                {ALL_ROLES.map(role => (
                  <button key={role} onClick={() => setForm(f => ({
                    ...f, visibility_roles: f.visibility_roles.includes(role)
                      ? f.visibility_roles.filter(r => r !== role) : [...f.visibility_roles, role],
                  }))}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                    style={{ backgroundColor: form.visibility_roles.includes(role) ? 'var(--brand-forest)' : 'rgba(0,0,0,0.06)', color: form.visibility_roles.includes(role) ? 'var(--brand-parchment)' : 'var(--text-secondary)' }}>
                    {role}
                  </button>
                ))}
              </div>
            </div>

            {createError && <p className="text-sm mb-3" style={{ color: 'var(--brand-crimson)' }}>{createError}</p>}
            <button onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.title || !form.destination || !form.start_date || !form.end_date}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
              style={{ backgroundColor: 'var(--brand-crimson)' }}>
              {createMutation.isPending ? 'Creating…' : 'Create trip'}
            </button>
          </div>
        )}

        {/* Trips list */}
        {isLoading ? (
          <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }} />)}</div>
        ) : trips.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No trips yet.</p>
        ) : (
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
            {trips.map((trip, i) => (
              <div key={trip.id} className="px-5 py-4 flex items-center justify-between gap-4"
                style={{ borderTop: i > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{trip.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {trip.destination} · {formatDate(trip.start_date)} → {formatDate(trip.end_date)}
                    {' · '}{formatCurrency(trip.total_cost, 'EUR')}
                    {' · '}{trip.milestones?.length ?? 0} milestones
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button onClick={() => startEditing(trip)} className="text-xs hover:opacity-70 transition-opacity" style={{ color: 'var(--text-secondary)' }}>Edit</button>
                  <button onClick={() => deleteMutation.mutate(trip.id)} className="text-xs hover:opacity-70 transition-opacity" style={{ color: 'var(--brand-crimson)' }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Edit trip ── */}
      {editing && (
        <section>
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>Edit: {editing.title}</p>
              <button onClick={() => setEditing(null)} className="text-xs hover:opacity-70 transition-opacity" style={{ color: 'var(--text-secondary)' }}>Cancel</button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              {(['title', 'destination'] as const).map(k => (
                <div key={k}>
                  <label className="text-xs mb-1 block capitalize" style={{ color: 'var(--text-secondary)' }}>{k}</label>
                  <input value={(editForm as Record<string, unknown>)[k] as string} onChange={e => setEditForm(f => ({ ...f, [k]: e.target.value }))}
                    className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm" style={{ color: 'var(--text-primary)' }} />
                </div>
              ))}
            </div>
            <div className="mb-4">
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Description</label>
              <textarea value={(editForm as Record<string, unknown>).description as string} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                rows={3} className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm resize-none" style={{ color: 'var(--text-primary)' }} />
            </div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div><label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Start date</label>
                <input type="date" value={editForm.start_date} onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))} className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm" style={{ color: 'var(--text-primary)' }} /></div>
              <div><label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>End date</label>
                <input type="date" value={editForm.end_date} onChange={e => setEditForm(f => ({ ...f, end_date: e.target.value }))} className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm" style={{ color: 'var(--text-primary)' }} /></div>
              <div><label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Total cost (EUR)</label>
                <input type="number" value={editForm.total_cost} onChange={e => setEditForm(f => ({ ...f, total_cost: Number(e.target.value) }))} className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm" style={{ color: 'var(--text-primary)' }} /></div>
            </div>
            <div className="mb-6">
              <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>Payment milestones</p>
              {editForm.milestones.map((m, i) => (
                <div key={i} className="flex items-center gap-3 text-sm mb-2 py-2 border-b border-black/5">
                  <span className="flex-1 font-medium" style={{ color: 'var(--text-primary)' }}>{m.label}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{formatCurrency(m.amount, 'EUR')}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{m.due_date}</span>
                  <button onClick={() => removeEditMilestone(i)} className="text-xs" style={{ color: 'var(--brand-crimson)' }}>Remove</button>
                </div>
              ))}
              <div className="grid grid-cols-4 gap-2 mt-3">
                <input placeholder="Label" value={editMilestoneInput.label} onChange={e => setEditMilestoneInput(m => ({ ...m, label: e.target.value }))} className="border border-black/10 rounded-xl px-3 py-2 text-sm col-span-1" style={{ color: 'var(--text-primary)' }} />
                <input placeholder="Amount" type="number" value={editMilestoneInput.amount} onChange={e => setEditMilestoneInput(m => ({ ...m, amount: e.target.value }))} className="border border-black/10 rounded-xl px-3 py-2 text-sm" style={{ color: 'var(--text-primary)' }} />
                <input type="date" value={editMilestoneInput.due_date} onChange={e => setEditMilestoneInput(m => ({ ...m, due_date: e.target.value }))} className="border border-black/10 rounded-xl px-3 py-2 text-sm" style={{ color: 'var(--text-primary)' }} />
                <button onClick={addEditMilestone} className="border border-black/10 rounded-xl text-sm hover:bg-black/[0.02] transition-colors" style={{ color: 'var(--text-primary)' }}>+ Add</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Location</label>
                <input value={editForm.location ?? ''} onChange={e => setEditForm(f => ({ ...f, location: e.target.value || null }))} placeholder="e.g. Oradea, Romania" className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm" style={{ color: 'var(--text-primary)' }} /></div>
              <div><label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Trip type</label>
                <input value={editForm.trip_type ?? ''} onChange={e => setEditForm(f => ({ ...f, trip_type: e.target.value || null }))} placeholder="e.g. leisure, training, business" className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm" style={{ color: 'var(--text-primary)' }} /></div>
              <div><label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Accommodation type</label>
                <input value={editForm.accommodation_type ?? ''} onChange={e => setEditForm(f => ({ ...f, accommodation_type: e.target.value || null }))} placeholder="e.g. hotel, hostel, apartment" className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm" style={{ color: 'var(--text-primary)' }} /></div>
              <div><label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Inclusions (comma-separated)</label>
                <input value={editForm.inclusions.join(', ')} onChange={e => setEditForm(f => ({ ...f, inclusions: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} placeholder="e.g. flights, hotel, breakfast" className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm" style={{ color: 'var(--text-primary)' }} /></div>
            </div>
            <div className="mb-6">
              <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>Visible to</p>
              <div className="flex gap-2">
                {ALL_ROLES.map(role => (
                  <button key={role} onClick={() => setEditForm(f => ({
                    ...f, visibility_roles: f.visibility_roles.includes(role)
                      ? f.visibility_roles.filter(r => r !== role) : [...f.visibility_roles, role],
                  }))}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                    style={{ backgroundColor: editForm.visibility_roles.includes(role) ? 'var(--brand-forest)' : 'rgba(0,0,0,0.06)', color: editForm.visibility_roles.includes(role) ? 'var(--brand-parchment)' : 'var(--text-secondary)' }}>
                    {role}
                  </button>
                ))}
              </div>
            </div>
            {editError && <p className="text-sm mb-3" style={{ color: 'var(--brand-crimson)' }}>{editError}</p>}
            <div className="flex gap-3">
              <button onClick={() => updateMutation.mutate({ id: editing.id, ...editForm })}
                disabled={updateMutation.isPending || !editForm.title || !editForm.destination || !editForm.start_date || !editForm.end_date}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: 'var(--brand-crimson)' }}>
                {updateMutation.isPending ? 'Saving…' : 'Save changes'}
              </button>
              <button onClick={() => setEditing(null)}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-black/5"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>Cancel</button>
            </div>
          </div>
        </section>
      )}

      {/* ── Payment entry ── */}
      <section>
        <div className="mb-4">
          <h2 className="font-display text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Log a payment</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Record a payment against an approved member registration.</p>
        </div>
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Trip</label>
              <select value={selectedTripId} onChange={e => { setSelectedTripId(e.target.value); setSelectedProfileId('') }}
                className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm bg-white" style={{ color: 'var(--text-primary)' }}>
                <option value="">Select trip…</option>
                {trips.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Member</label>
              <select value={selectedProfileId} onChange={e => setSelectedProfileId(e.target.value)}
                disabled={!selectedTripId || approvedRegistrations.length === 0}
                className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm bg-white disabled:opacity-50" style={{ color: 'var(--text-primary)' }}>
                <option value="">{!selectedTripId ? 'Select trip first…' : approvedRegistrations.length === 0 ? 'No approved members' : 'Select member…'}</option>
                {approvedRegistrations.map(r => (
                  <option key={r.profile_id} value={r.profile_id}>{r.profile.first_name} {r.profile.last_name}{r.profile.abo_number ? ` · ${r.profile.abo_number}` : ''}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Amount (EUR)</label>
              <input type="number" step="0.01" min="0" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="0.00"
                className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm" style={{ color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Date</label>
              <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)}
                className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm" style={{ color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Status</label>
              <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value as 'completed' | 'pending' | 'failed')}
                className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm bg-white" style={{ color: 'var(--text-primary)' }}>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
          <div className="mb-5">
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Note <span className="font-normal opacity-60">(optional)</span></label>
            <input value={paymentNote} onChange={e => setPaymentNote(e.target.value)} placeholder="e.g. Cash payment, bank transfer ref…"
              className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm" style={{ color: 'var(--text-primary)' }} />
          </div>
          {paymentError && <p className="text-sm mb-3" style={{ color: 'var(--brand-crimson)' }}>{paymentError}</p>}
          <button onClick={submitPayment}
            disabled={paymentMutation.isPending || !selectedTripId || !selectedProfileId || !paymentAmount || Number(paymentAmount) <= 0}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'var(--brand-teal)' }}>
            {paymentMutation.isPending ? 'Saving…' : 'Log payment'}
          </button>
        </div>

        {selectedTripId && tripPayments.length > 0 && (
          <div className="mt-4 bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-black/5">
              <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>Recent payments — {selectedTrip?.title}</p>
            </div>
            {tripPayments.map((p, i) => (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-4" style={{ borderTop: i > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{formatCurrency(p.amount, 'EUR')}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{formatDate(p.transaction_date)}{p.note && ` · ${p.note}`}</p>
                </div>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: p.status === 'completed' ? '#81b29a33' : '#f2cc8f33', color: p.status === 'completed' ? '#2d6a4f' : '#7a5c00' }}>
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Payment Submissions ── */}
      {pendingSubmissions.length > 0 && (
        <section>
          <div className="mb-4">
            <h2 className="font-display text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Payment Submissions</h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Member-submitted payments awaiting approval.</p>
          </div>
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
            {pendingSubmissions.map((sub, i) => (
              <div key={sub.id} className="px-5 py-4 space-y-3" style={{ borderTop: i > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {sub.profiles?.first_name} {sub.profiles?.last_name}
                      {sub.profiles?.abo_number && <span className="font-mono font-normal ml-2 text-xs opacity-60">{sub.profiles.abo_number}</span>}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {sub.trips?.title ?? '—'} · {formatDate(sub.transaction_date)} · {formatCurrency(sub.amount, 'EUR')}
                      {sub.payment_method && ` · ${sub.payment_method}`}
                    </p>
                    {sub.note && <p className="text-xs mt-0.5 italic" style={{ color: 'var(--text-secondary)' }}>{sub.note}</p>}
                    {sub.proof_url && <a href={sub.proof_url} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: 'var(--brand-teal)' }}>View proof ↗</a>}
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#f2cc8f33', color: '#7a5c00' }}>pending</span>
                </div>
                <div className="flex items-center gap-3">
                  <input value={reviewNotes[sub.id] ?? ''} onChange={e => setReviewNotes(n => ({ ...n, [sub.id]: e.target.value }))}
                    placeholder="Admin note (optional)" className="flex-1 border border-black/10 rounded-xl px-3 py-2 text-xs" style={{ color: 'var(--text-primary)' }} />
                  <button onClick={() => reviewMutation.mutate({ id: sub.id, status: 'completed', note: reviewNotes[sub.id] || null })}
                    disabled={reviewMutation.isPending}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
                    style={{ backgroundColor: '#2d6a4f' }}>Approve</button>
                  <button onClick={() => reviewMutation.mutate({ id: sub.id, status: 'failed', note: reviewNotes[sub.id] || null })}
                    disabled={reviewMutation.isPending}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
                    style={{ backgroundColor: 'var(--brand-crimson)' }}>Deny</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
