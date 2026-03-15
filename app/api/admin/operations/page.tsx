'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

type Milestone = { label: string; amount: number; due_date: string }
type Trip = {
  id: string; title: string; destination: string; description: string
  start_date: string; end_date: string; total_cost: number; milestones: Milestone[]
  currency: string; image_url: string | null
}

const empty = (): Omit<Trip, 'id' | 'currency' | 'image_url'> => ({
  title: '', destination: '', description: '',
  start_date: '', end_date: '', total_cost: 0, milestones: [],
})

export default function OperationsPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState(empty())
  const [milestoneInput, setMilestoneInput] = useState({ label: '', amount: '', due_date: '' })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: trips = [], isLoading } = useQuery<Trip[]>({
    queryKey: ['trips'],
    queryFn: () => fetch('/api/trips').then(r => r.json()),
  })

  const createMutation = useMutation({
    mutationFn: (body: typeof form) =>
      fetch('/api/trips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trips'] })
      setForm(empty())
      setCreating(false)
      setError(null)
    },
    onError: (e: Error) => setError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/trips/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trips'] }),
  })

  function addMilestone() {
    if (!milestoneInput.label || !milestoneInput.amount || !milestoneInput.due_date) return
    setForm(f => ({ ...f, milestones: [...f.milestones, { label: milestoneInput.label, amount: Number(milestoneInput.amount), due_date: milestoneInput.due_date }] }))
    setMilestoneInput({ label: '', amount: '', due_date: '' })
  }

  function removeMilestone(i: number) {
    setForm(f => ({ ...f, milestones: f.milestones.filter((_, idx) => idx !== i) }))
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Operations</h1>
        <button
          onClick={() => setCreating(c => !c)}
          className="bg-[#bc4749] text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          {creating ? 'Cancel' : '+ New Trip'}
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="border border-gray-200 rounded-xl p-6 mb-8 bg-white">
          <h2 className="text-lg font-medium mb-4">New trip</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {(['title', 'destination'] as const).map(k => (
              <div key={k}>
                <label className="text-xs text-gray-500 mb-1 block capitalize">{k}</label>
                <input
                  value={form[k]}
                  onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            ))}
          </div>
          <div className="mb-4">
            <label className="text-xs text-gray-500 mb-1 block">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Start date</label>
              <input type="date" value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">End date</label>
              <input type="date" value={form.end_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Total cost (EUR)</label>
              <input type="number" value={form.total_cost}
                onChange={e => setForm(f => ({ ...f, total_cost: Number(e.target.value) }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          {/* Milestones */}
          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-2">Payment milestones</p>
            {form.milestones.map((m, i) => (
              <div key={i} className="flex items-center gap-3 text-sm mb-2">
                <span className="flex-1">{m.label}</span>
                <span className="text-gray-500">€{m.amount}</span>
                <span className="text-gray-500">{m.due_date}</span>
                <button onClick={() => removeMilestone(i)} className="text-red-500 text-xs">Remove</button>
              </div>
            ))}
            <div className="grid grid-cols-4 gap-2 mt-2">
              <input placeholder="Label" value={milestoneInput.label}
                onChange={e => setMilestoneInput(m => ({ ...m, label: e.target.value }))}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm col-span-1" />
              <input placeholder="Amount" type="number" value={milestoneInput.amount}
                onChange={e => setMilestoneInput(m => ({ ...m, amount: e.target.value }))}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
              <input type="date" value={milestoneInput.due_date}
                onChange={e => setMilestoneInput(m => ({ ...m, due_date: e.target.value }))}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
              <button onClick={addMilestone}
                className="border border-gray-300 rounded-lg text-sm px-2 py-1.5 hover:bg-gray-50">
                + Add
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          <button
            onClick={() => createMutation.mutate(form)}
            disabled={createMutation.isPending || !form.title || !form.destination || !form.start_date || !form.end_date}
            className="bg-[#bc4749] text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating...' : 'Create trip'}
          </button>
        </div>
      )}

      {/* Trips list */}
      {isLoading ? (
        <p className="text-sm text-gray-400">Loading trips...</p>
      ) : trips.length === 0 ? (
        <p className="text-sm text-gray-400">No trips yet.</p>
      ) : (
        <div className="space-y-3">
          {trips.map(trip => (
            <div key={trip.id} className="border border-gray-200 rounded-xl p-4 bg-white">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{trip.title}</p>
                  <p className="text-sm text-gray-500">{trip.destination} · {trip.start_date} → {trip.end_date}</p>
                  <p className="text-sm text-gray-500 mt-0.5">€{trip.total_cost} · {trip.milestones?.length ?? 0} milestones</p>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(trip.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}