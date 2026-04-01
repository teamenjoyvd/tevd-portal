'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDate, formatCurrency } from '@/lib/format'
import { Drawer } from '@/components/ui/Drawer'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'

// ── Types ────────────────────────────────────────────────────────

export type Milestone = { label: string; amount: number; due_date: string }

export type Trip = {
  id: string; title: string; destination: string
  start_date: string; end_date: string
  total_cost: number; milestones: Milestone[]
  currency: string; description: string
  location: string | null; accommodation_type: string | null
  inclusions: string[]; trip_type: string | null
  visibility_roles: string[]
}

type TripAttachment = {
  id: string
  file_url: string
  file_name: string
  file_type: 'pdf' | 'image'
  sort_order: number
  created_at: string
}

// ── Constants ────────────────────────────────────────────────────

export const ALL_ROLES = ['guest', 'member', 'core', 'admin']

// ── Helpers ──────────────────────────────────────────────────────

const emptyTrip = (): Omit<Trip, 'id' | 'currency'> => ({
  title: '', destination: '', description: '',
  start_date: '', end_date: '', total_cost: 0, milestones: [],
  location: null, accommodation_type: null,
  inclusions: [], trip_type: null,
  visibility_roles: [...ALL_ROLES],
})

// ── Attachment section (edit-mode only) ──────────────────────────

function AttachmentsSection({ tripId }: { tripId: string }) {
  const qc = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TripAttachment | null>(null)

  const { data: attachments = [], isLoading } = useQuery<TripAttachment[]>({
    queryKey: ['trip-attachments-admin', tripId],
    queryFn: () =>
      fetch(`/api/admin/trips/${tripId}/attachments`).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? 'Failed to load')
        return r.json()
      }),
  })

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/admin/trips/${tripId}/attachments`, { method: 'POST', body: fd })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Upload failed')
      }
      qc.invalidateQueries({ queryKey: ['trip-attachments-admin', tripId] })
    } catch (err) {
      setUploadError((err as Error).message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const deleteMutation = useMutation({
    mutationFn: (attachment: TripAttachment) =>
      fetch(`/api/admin/trips/${tripId}/attachments/${attachment.id}`, { method: 'DELETE' }).then(r => {
        if (!r.ok && r.status !== 204) throw new Error('Delete failed')
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trip-attachments-admin', tripId] })
      setDeleteTarget(null)
    },
  })

  const inputStyle = {
    borderColor: 'var(--border-default)',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-card)',
  }

  return (
    <div>
      <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>
        Trip documents
      </p>

      {isLoading ? (
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Loading…</p>
      ) : attachments.length > 0 ? (
        <div className="rounded-xl border mb-3 overflow-hidden" style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-card)' }}>
          {attachments.map((a, i) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
              style={{ borderTop: i > 0 ? '1px solid var(--border-default)' : 'none' }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{
                    backgroundColor: a.file_type === 'pdf' ? 'rgba(188,71,73,0.12)' : 'rgba(62,119,133,0.12)',
                    color: a.file_type === 'pdf' ? 'var(--brand-crimson)' : 'var(--brand-teal)',
                  }}
                >
                  {a.file_type.toUpperCase()}
                </span>
                <a
                  href={a.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm truncate hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {a.file_name}
                </a>
              </div>
              <button
                onClick={() => setDeleteTarget(a)}
                className="text-xs flex-shrink-0 hover:opacity-70 transition-opacity"
                style={{ color: 'var(--brand-crimson)' }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>No documents uploaded yet.</p>
      )}

      <label className="flex items-center gap-2 cursor-pointer">
        <span
          className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors hover:bg-black/5 flex-shrink-0"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
        >
          {uploading ? 'Uploading…' : '+ Upload file'}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>PDF or image, max 10 MB</span>
        <input
          type="file"
          accept="image/*,application/pdf"
          className="sr-only"
          onChange={handleUpload}
          disabled={uploading}
        />
      </label>

      {uploadError && (
        <p className="text-xs mt-2" style={{ color: 'var(--brand-crimson)' }}>{uploadError}</p>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove document</AlertDialogTitle>
            <AlertDialogDescription>
              Remove &ldquo;{deleteTarget?.file_name}&rdquo;? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget) }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── Component ────────────────────────────────────────────────────

export function TripsTab({ trips, isLoading }: { trips: Trip[]; isLoading: boolean }) {
  const qc = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Trip | null>(null)
  const [form, setForm] = useState<Omit<Trip, 'id' | 'currency'>>(emptyTrip())
  const [milestoneInput, setMilestoneInput] = useState({ label: '', amount: '', due_date: '' })
  const [error, setError] = useState<string | null>(null)
  const [alertTarget, setAlertTarget] = useState<{ id: string; name: string } | null>(null)

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
    if (editing) updateMutation.mutate({ id: editing.id, ...form })
    else createMutation.mutate(form)
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
                  onClick={() => setAlertTarget({ id: trip.id, name: trip.title })}
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
                  style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
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
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Start date</label>
              <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="w-full border rounded-xl px-3 py-2.5 text-sm" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>End date</label>
              <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="w-full border rounded-xl px-3 py-2.5 text-sm" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Cost (EUR)</label>
              <input type="number" value={form.total_cost} onChange={e => setForm(f => ({ ...f, total_cost: Number(e.target.value) }))}
                className="w-full border rounded-xl px-3 py-2.5 text-sm" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
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
                className="border rounded-xl px-3 py-2 text-sm col-span-1" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
              <input placeholder="Amount" type="number" value={milestoneInput.amount}
                onChange={e => setMilestoneInput(m => ({ ...m, amount: e.target.value }))}
                className="border rounded-xl px-3 py-2 text-sm" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
              <input type="date" value={milestoneInput.due_date}
                onChange={e => setMilestoneInput(m => ({ ...m, due_date: e.target.value }))}
                className="border rounded-xl px-3 py-2 text-sm" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
              <button onClick={addMilestone}
                className="border rounded-xl text-sm hover:bg-black/5 transition-colors" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>+ Add</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Location</label>
              <input value={form.location ?? ''} onChange={e => setForm(f => ({ ...f, location: e.target.value || null }))}
                placeholder="e.g. Oradea, Romania" className="w-full border rounded-xl px-3 py-2.5 text-sm"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Trip type</label>
              <input value={form.trip_type ?? ''} onChange={e => setForm(f => ({ ...f, trip_type: e.target.value || null }))}
                placeholder="e.g. leisure, training" className="w-full border rounded-xl px-3 py-2.5 text-sm"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Accommodation</label>
              <input value={form.accommodation_type ?? ''} onChange={e => setForm(f => ({ ...f, accommodation_type: e.target.value || null }))}
                placeholder="e.g. hotel, hostel" className="w-full border rounded-xl px-3 py-2.5 text-sm"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Inclusions (comma-sep)</label>
              <input value={form.inclusions.join(', ')} onChange={e => setForm(f => ({ ...f, inclusions: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                placeholder="e.g. flights, hotel" className="w-full border rounded-xl px-3 py-2.5 text-sm"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
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

          {editing && (
            <div className="pt-2 border-t" style={{ borderColor: 'var(--border-default)' }}>
              <AttachmentsSection tripId={editing.id} />
            </div>
          )}

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

      <AlertDialog open={!!alertTarget} onOpenChange={open => { if (!open) setAlertTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete trip</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &ldquo;{alertTarget?.name}&rdquo;? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (alertTarget) deleteMutation.mutate(alertTarget.id)
                setAlertTarget(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
