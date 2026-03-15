'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

type Milestone = { label: string; amount: number; due_date: string }

type Trip = {
  id: string; title: string; destination: string
  start_date: string; end_date: string
  total_cost: number; milestones: Milestone[]
  currency: string
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

const empty = (): Omit<Trip, 'id' | 'currency'> => ({
  title: '', destination: '', description: '',
  start_date: '', end_date: '', total_cost: 0, milestones: [],
} as unknown as Omit<Trip, 'id' | 'currency'>)

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function formatEur(n: number) {
  return new Intl.NumberFormat('en-DE', { style: 'currency', currency: 'EUR' }).format(n)
}

export default function OperationsPage() {
  const qc = useQueryClient()

  // ── Trip creation state ──
  const [form, setForm] = useState(empty())
  const [milestoneInput, setMilestoneInput] = useState({ label: '', amount: '', due_date: '' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // ── Payment entry state ──
  const [selectedTripId, setSelectedTripId] = useState<string>('')
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')
  const [paymentAmount, setPaymentAmount] = useState<string>('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentNote, setPaymentNote] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<'completed' | 'pending' | 'failed'>('completed')
  const [paymentError, setPaymentError] = useState<string | null>(null)

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
      // Enrich with profile info from registrations
      return data
    },
    enabled: !!selectedTripId,
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

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-10">

      {/* ── Trip creation ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-serif text-2xl font-semibold" style={{ color: 'var(--deep)' }}>
              Operations
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--stone)' }}>
              Manage trips, milestones, and member payments.
            </p>
          </div>
          <button
            onClick={() => setCreating(c => !c)}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--crimson)' }}
          >
            {creating ? 'Cancel' : '+ New trip'}
          </button>
        </div>

        {/* Create form */}
        {creating && (
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-6 mb-6">
            <p className="text-xs font-semibold tracking-widest uppercase mb-4"
              style={{ color: 'var(--stone)' }}>
              New trip
            </p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              {(['title', 'destination'] as const).map(k => (
                <div key={k}>
                  <label className="text-xs mb-1 block capitalize" style={{ color: 'var(--stone)' }}>
                    {k}
                  </label>
                  <input
                    value={(form as Record<string, unknown>)[k] as string}
                    onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                    className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                    style={{ color: 'var(--deep)' }}
                  />
                </div>
              ))}
            </div>
            <div className="mb-4">
              <label className="text-xs mb-1 block" style={{ color: 'var(--stone)' }}>
                Description
              </label>
              <textarea
                value={(form as Record<string, unknown>).description as string}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm resize-none"
                style={{ color: 'var(--deep)' }}
              />
            </div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--stone)' }}>
                  Start date
                </label>
                <input type="date" value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                  style={{ color: 'var(--deep)' }} />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--stone)' }}>
                  End date
                </label>
                <input type="date" value={form.end_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                  className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                  style={{ color: 'var(--deep)' }} />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--stone)' }}>
                  Total cost (EUR)
                </label>
                <input type="number" value={form.total_cost}
                  onChange={e => setForm(f => ({ ...f, total_cost: Number(e.target.value) }))}
                  className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                  style={{ color: 'var(--deep)' }} />
              </div>
            </div>

            {/* Milestones */}
            <div className="mb-6">
              <p className="text-xs font-semibold tracking-widest uppercase mb-3"
                style={{ color: 'var(--stone)' }}>
                Payment milestones
              </p>
              {form.milestones.map((m, i) => (
                <div key={i} className="flex items-center gap-3 text-sm mb-2 py-2 border-b border-black/5">
                  <span className="flex-1 font-medium" style={{ color: 'var(--deep)' }}>{m.label}</span>
                  <span style={{ color: 'var(--stone)' }}>{formatEur(m.amount)}</span>
                  <span style={{ color: 'var(--stone)' }}>{m.due_date}</span>
                  <button onClick={() => removeMilestone(i)}
                    className="text-xs" style={{ color: 'var(--crimson)' }}>
                    Remove
                  </button>
                </div>
              ))}
              <div className="grid grid-cols-4 gap-2 mt-3">
                <input placeholder="Label" value={milestoneInput.label}
                  onChange={e => setMilestoneInput(m => ({ ...m, label: e.target.value }))}
                  className="border border-black/10 rounded-xl px-3 py-2 text-sm col-span-1"
                  style={{ color: 'var(--deep)' }} />
                <input placeholder="Amount" type="number" value={milestoneInput.amount}
                  onChange={e => setMilestoneInput(m => ({ ...m, amount: e.target.value }))}
                  className="border border-black/10 rounded-xl px-3 py-2 text-sm"
                  style={{ color: 'var(--deep)' }} />
                <input type="date" value={milestoneInput.due_date}
                  onChange={e => setMilestoneInput(m => ({ ...m, due_date: e.target.value }))}
                  className="border border-black/10 rounded-xl px-3 py-2 text-sm"
                  style={{ color: 'var(--deep)' }} />
                <button onClick={addMilestone}
                  className="border border-black/10 rounded-xl text-sm hover:bg-black/[0.02] transition-colors"
                  style={{ color: 'var(--deep)' }}>
                  + Add
                </button>
              </div>
            </div>

            {createError && (
              <p className="text-sm mb-3" style={{ color: 'var(--crimson)' }}>{createError}</p>
            )}

            <button
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.title || !form.destination || !form.start_date || !form.end_date}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
              style={{ backgroundColor: 'var(--crimson)' }}
            >
              {createMutation.isPending ? 'Creating…' : 'Create trip'}
            </button>
          </div>
        )}

        {/* Trips list */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl animate-pulse"
                style={{ backgroundColor: 'rgba(0,0,0,0.05)' }} />
            ))}
          </div>
        ) : trips.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--stone)' }}>No trips yet.</p>
        ) : (
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
            {trips.map((trip, i) => (
              <div key={trip.id}
                className="px-5 py-4 flex items-center justify-between gap-4"
                style={{ borderTop: i > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--deep)' }}>
                    {trip.title}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--stone)' }}>
                    {trip.destination} · {formatDate(trip.start_date)} → {formatDate(trip.end_date)}
                    {' · '}{formatEur(trip.total_cost)}
                    {' · '}{trip.milestones?.length ?? 0} milestones
                  </p>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(trip.id)}
                  className="text-xs hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--crimson)' }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Payment entry ── */}
      <section>
        <div className="mb-4">
          <h2 className="font-serif text-xl font-semibold" style={{ color: 'var(--deep)' }}>
            Log a payment
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--stone)' }}>
            Record a payment against an approved member registration.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Trip selector */}
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--stone)' }}>
                Trip
              </label>
              <select
                value={selectedTripId}
                onChange={e => {
                  setSelectedTripId(e.target.value)
                  setSelectedProfileId('')
                }}
                className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm bg-white"
                style={{ color: 'var(--deep)' }}
              >
                <option value="">Select trip…</option>
                {trips.map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>

            {/* Member selector — only approved registrations */}
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--stone)' }}>
                Member
              </label>
              <select
                value={selectedProfileId}
                onChange={e => setSelectedProfileId(e.target.value)}
                disabled={!selectedTripId || approvedRegistrations.length === 0}
                className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm bg-white disabled:opacity-50"
                style={{ color: 'var(--deep)' }}
              >
                <option value="">
                  {!selectedTripId
                    ? 'Select trip first…'
                    : approvedRegistrations.length === 0
                    ? 'No approved members'
                    : 'Select member…'}
                </option>
                {approvedRegistrations.map(r => (
                  <option key={r.profile_id} value={r.profile_id}>
                    {r.profile.first_name} {r.profile.last_name}
                    {r.profile.abo_number ? ` · ${r.profile.abo_number}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            {/* Amount */}
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--stone)' }}>
                Amount (EUR)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                style={{ color: 'var(--deep)' }}
              />
            </div>

            {/* Date */}
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--stone)' }}>
                Date
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                style={{ color: 'var(--deep)' }}
              />
            </div>

            {/* Status */}
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--stone)' }}>
                Status
              </label>
              <select
                value={paymentStatus}
                onChange={e => setPaymentStatus(e.target.value as 'completed' | 'pending' | 'failed')}
                className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm bg-white"
                style={{ color: 'var(--deep)' }}
              >
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          {/* Note */}
          <div className="mb-5">
            <label className="text-xs mb-1 block" style={{ color: 'var(--stone)' }}>
              Note <span className="font-normal opacity-60">(optional)</span>
            </label>
            <input
              value={paymentNote}
              onChange={e => setPaymentNote(e.target.value)}
              placeholder="e.g. Cash payment, bank transfer ref…"
              className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
              style={{ color: 'var(--deep)' }}
            />
          </div>

          {paymentError && (
            <p className="text-sm mb-3" style={{ color: 'var(--crimson)' }}>{paymentError}</p>
          )}

          <button
            onClick={submitPayment}
            disabled={
              paymentMutation.isPending ||
              !selectedTripId ||
              !selectedProfileId ||
              !paymentAmount ||
              Number(paymentAmount) <= 0
            }
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'var(--sage)' }}
          >
            {paymentMutation.isPending ? 'Saving…' : 'Log payment'}
          </button>
        </div>

        {/* Recent payments for selected trip */}
        {selectedTripId && tripPayments.length > 0 && (
          <div className="mt-4 bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-black/5">
              <p className="text-xs font-semibold tracking-widest uppercase"
                style={{ color: 'var(--stone)' }}>
                Recent payments — {selectedTrip?.title}
              </p>
            </div>
            {tripPayments.map((p, i) => (
              <div key={p.id}
                className="px-5 py-3 flex items-center justify-between gap-4"
                style={{ borderTop: i > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--deep)' }}>
                    {formatEur(p.amount)}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--stone)' }}>
                    {formatDate(p.transaction_date)}
                    {p.note && ` · ${p.note}`}
                  </p>
                </div>
                <span
                  className="text-xs font-medium px-2.5 py-1 rounded-full"
                  style={{
                    backgroundColor: p.status === 'completed' ? '#81b29a33' : '#f2cc8f33',
                    color: p.status === 'completed' ? '#2d6a4f' : '#7a5c00',
                  }}
                >
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  )
}