'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

type CalEvent = {
  id: string
  title: string
  description: string | null
  start_time: string
  end_time: string
  week_number: number
  category: 'N21' | 'Personal'
  event_type: 'in-person' | 'online' | 'hybrid' | null
  visibility_roles: string[]
  google_event_id: string | null
}

const ALL_ROLES = ['guest', 'member', 'core', 'admin']
const CATEGORIES = ['N21', 'Personal'] as const
const EVENT_TYPES = ['in-person', 'online', 'hybrid'] as const

function emptyForm() {
  return {
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    week_number: 0,
    category: 'N21' as 'N21' | 'Personal',
    event_type: null as 'in-person' | 'online' | 'hybrid' | null,
    visibility_roles: [...ALL_ROLES],
  }
}

function formatDT(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function AdminCalendarPage() {
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [editing, setEditing] = useState<CalEvent | null>(null)
  const [editForm, setEditForm] = useState(emptyForm())
  const [formError, setFormError] = useState<string | null>(null)

  const { data: events = [], isLoading } = useQuery<CalEvent[]>({
    queryKey: ['admin-calendar'],
    queryFn: () => fetch('/api/admin/calendar').then(r => r.json()),
  })

  const createMutation = useMutation({
    mutationFn: (body: typeof form) =>
      fetch('/api/admin/calendar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-calendar'] })
      setCreating(false)
      setForm(emptyForm())
      setFormError(null)
    },
    onError: (e: Error) => setFormError(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & typeof editForm) =>
      fetch(`/api/admin/calendar/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-calendar'] })
      setEditing(null)
      setFormError(null)
    },
    onError: (e: Error) => setFormError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/admin/calendar/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-calendar'] }),
  })

  function startEditing(ev: CalEvent) {
    setEditForm({
      title: ev.title,
      description: ev.description ?? '',
      start_time: ev.start_time.slice(0, 16),
      end_time: ev.end_time.slice(0, 16),
      week_number: ev.week_number,
      category: ev.category,
      event_type: ev.event_type,
      visibility_roles: Array.isArray(ev.visibility_roles) ? ev.visibility_roles : [...ALL_ROLES],
    })
    setFormError(null)
    setEditing(ev)
  }

  function EventForm({
    f, setF, onSave, onCancel, isPending, label,
  }: {
    f: typeof form
    setF: (fn: (prev: typeof form) => typeof form) => void
    onSave: () => void
    onCancel: () => void
    isPending: boolean
    label: string
  }) {
    return (
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-6 mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>{label}</p>
          <button onClick={onCancel} className="text-xs hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>Cancel</button>
        </div>
        <input value={f.title} onChange={e => setF(p => ({ ...p, title: e.target.value }))}
          placeholder="Title" className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
          style={{ color: 'var(--text-primary)' }} />
        <textarea value={f.description ?? ''} onChange={e => setF(p => ({ ...p, description: e.target.value }))}
          placeholder="Description (optional)" rows={2} className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm resize-none"
          style={{ color: 'var(--text-primary)' }} />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Start</label>
            <input type="datetime-local" value={f.start_time}
              onChange={e => setF(p => ({ ...p, start_time: e.target.value }))}
              className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
              style={{ color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>End</label>
            <input type="datetime-local" value={f.end_time}
              onChange={e => setF(p => ({ ...p, end_time: e.target.value }))}
              className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
              style={{ color: 'var(--text-primary)' }} />
          </div>
        </div>
        <div className="flex flex-wrap gap-4 items-start">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Category</label>
            <div className="flex gap-2">
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setF(p => ({ ...p, category: c }))}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: f.category === c ? 'var(--brand-forest)' : 'rgba(0,0,0,0.06)',
                    color: f.category === c ? 'var(--brand-parchment)' : 'var(--text-secondary)',
                  }}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Type</label>
            <div className="flex gap-2">
              {EVENT_TYPES.map(t => (
                <button key={t} onClick={() => setF(p => ({ ...p, event_type: f.event_type === t ? null : t }))}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: f.event_type === t ? 'var(--brand-teal)' : 'rgba(0,0,0,0.06)',
                    color: f.event_type === t ? 'white' : 'var(--text-secondary)',
                  }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Visible to</label>
            <div className="flex gap-2">
              {ALL_ROLES.map(role => (
                <button key={role} onClick={() => setF(p => ({
                  ...p,
                  visibility_roles: p.visibility_roles.includes(role)
                    ? p.visibility_roles.filter(r => r !== role)
                    : [...p.visibility_roles, role],
                }))}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: f.visibility_roles.includes(role) ? 'var(--brand-forest)' : 'rgba(0,0,0,0.06)',
                    color: f.visibility_roles.includes(role) ? 'var(--brand-parchment)' : 'var(--text-secondary)',
                  }}>
                  {role}
                </button>
              ))}
            </div>
          </div>
        </div>
        {formError && <p className="text-sm" style={{ color: 'var(--brand-crimson)' }}>{formError}</p>}
        <div className="flex gap-3 pt-1">
          <button onClick={onSave} disabled={isPending || !f.title || !f.start_time || !f.end_time}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'var(--brand-crimson)' }}>
            {isPending ? 'Saving…' : label}
          </button>
          <button onClick={onCancel}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-black/5"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Calendar Events</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Create, edit, and delete calendar events. Google Calendar sync also populates this table.
          </p>
        </div>
        {!creating && !editing && (
          <button onClick={() => { setCreating(true); setFormError(null) }}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'var(--brand-crimson)' }}>
            + New event
          </button>
        )}
      </div>

      {creating && (
        <EventForm
          f={form} setF={setForm as never}
          onSave={() => createMutation.mutate(form)}
          onCancel={() => { setCreating(false); setForm(emptyForm()); setFormError(null) }}
          isPending={createMutation.isPending}
          label="Create event"
        />
      )}

      {editing && (
        <EventForm
          f={editForm} setF={setEditForm as never}
          onSave={() => updateMutation.mutate({ id: editing.id, ...editForm })}
          onCancel={() => { setEditing(null); setFormError(null) }}
          isPending={updateMutation.isPending}
          label="Save changes"
        />
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--border-default)' }} />
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No events yet.</p>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border-default)' }}>
          {events.map((ev, i) => (
            <div key={ev.id}
              className="px-5 py-4 flex items-center gap-4"
              style={{ borderTop: i > 0 ? '1px solid var(--border-default)' : 'none', backgroundColor: i % 2 === 0 ? 'white' : 'var(--bg-global)' }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{ev.title}</p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: ev.category === 'N21' ? 'var(--brand-forest)' : 'var(--sienna)', color: 'white' }}>
                    {ev.category}
                  </span>
                  {ev.event_type && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'rgba(62,119,133,0.15)', color: 'var(--brand-teal)' }}>
                      {ev.event_type}
                    </span>
                  )}
                  {ev.google_event_id && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}>
                      Google
                    </span>
                  )}
                </div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {formatDT(ev.start_time)} → {formatDT(ev.end_time)} · W{ev.week_number}
                  {' · '}{ev.visibility_roles.join(', ')}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <button onClick={() => startEditing(ev)}
                  className="text-xs hover:opacity-70 transition-opacity" style={{ color: 'var(--text-secondary)' }}>
                  Edit
                </button>
                <button onClick={() => { if (confirm(`Delete "${ev.title}"?`)) deleteMutation.mutate(ev.id) }}
                  disabled={deleteMutation.isPending}
                  className="text-xs hover:opacity-70 transition-opacity disabled:opacity-30" style={{ color: 'var(--brand-crimson)' }}>
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
