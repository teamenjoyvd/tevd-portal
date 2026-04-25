'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDateTime, toSofiaLocalInput, fromSofiaLocalInput } from '@/lib/format'
import { Drawer } from '@/components/ui/drawer'
import { useLanguage } from '@/lib/hooks/useLanguage'

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
  meeting_url: string | null
  allow_guest_registration: boolean
  available_roles: string[]
}

const ALL_ROLES = ['guest', 'member', 'core', 'admin']
const CATEGORIES = ['N21', 'Personal'] as const
const EVENT_TYPES = ['in-person', 'online', 'hybrid'] as const

type EventFormState = {
  title: string
  description: string
  start_time: string
  end_time: string
  week_number: number
  category: 'N21' | 'Personal'
  event_type: 'in-person' | 'online' | 'hybrid' | null
  visibility_roles: string[]
  meeting_url: string
  allow_guest_registration: boolean
  available_roles: string[]
}

function emptyForm(): EventFormState {
  return {
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    week_number: 0,
    category: 'N21',
    event_type: null,
    visibility_roles: [...ALL_ROLES],
    meeting_url: '',
    allow_guest_registration: true,
    available_roles: ['HOST', 'SPEAKER', 'PRODUCTS'],
  }
}

/**
 * Convert form time fields (Sofia local "datetime-local" strings) to UTC ISO
 * before API submission. All other fields pass through unchanged.
 */
function normalizeFormTimes(f: EventFormState): EventFormState {
  return {
    ...f,
    start_time: f.start_time ? fromSofiaLocalInput(f.start_time) : f.start_time,
    end_time:   f.end_time   ? fromSofiaLocalInput(f.end_time)   : f.end_time,
  }
}

// ── EventForm hoisted to module scope to prevent remount on parent render ──

function EventForm({
  f,
  setF,
  onSave,
  onCancel,
  isPending,
  label,
  formError,
}: {
  f: EventFormState
  setF: React.Dispatch<React.SetStateAction<EventFormState>>
  onSave: () => void
  onCancel: () => void
  isPending: boolean
  label: string
  formError: string | null
}) {
  const { t } = useLanguage()
  const [roleInput, setRoleInput] = useState('')

  function addRole() {
    const role = roleInput.trim().toUpperCase()
    if (role && !f.available_roles.includes(role)) {
      setF(p => ({ ...p, available_roles: [...p.available_roles, role] }))
    }
    setRoleInput('')
  }

  function removeRole(role: string) {
    setF(p => ({ ...p, available_roles: p.available_roles.filter(r => r !== role) }))
  }

  return (
    <div className="space-y-4">
      <input value={f.title} onChange={e => setF(p => ({ ...p, title: e.target.value }))}
        placeholder={t('admin.calendar.placeholder.title')} className="w-full border rounded-xl px-3 py-2.5 text-sm"
        style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
      <textarea value={f.description ?? ''} onChange={e => setF(p => ({ ...p, description: e.target.value }))}
        placeholder={t('admin.calendar.placeholder.description')} rows={2}
        className="w-full border rounded-xl px-3 py-2.5 text-sm resize-none"
        style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.calendar.lbl.start')}</label>
          <input type="datetime-local" value={f.start_time}
            onChange={e => setF(p => ({ ...p, start_time: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2.5 text-sm"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.calendar.lbl.end')}</label>
          <input type="datetime-local" value={f.end_time}
            onChange={e => setF(p => ({ ...p, end_time: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2.5 text-sm"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
        </div>
      </div>

      {/* Meeting URL */}
      <div>
        <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.calendar.lbl.meetingUrl')}</label>
        <input type="url" value={f.meeting_url} onChange={e => setF(p => ({ ...p, meeting_url: e.target.value }))}
          placeholder={t('admin.calendar.placeholder.meetingUrl')}
          className="w-full border rounded-xl px-3 py-2.5 text-sm"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
      </div>

      <div className="flex flex-wrap gap-4 items-start">
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.calendar.lbl.category')}</label>
          <div className="flex gap-2">
            {CATEGORIES.map(c => (
              <button key={c} type="button" onClick={() => setF(p => ({ ...p, category: c }))}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{ backgroundColor: f.category === c ? 'var(--brand-forest)' : 'rgba(0,0,0,0.06)', color: f.category === c ? 'var(--brand-parchment)' : 'var(--text-secondary)' }}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.calendar.lbl.type')}</label>
          <div className="flex gap-2">
            {EVENT_TYPES.map(t2 => (
              <button key={t2} type="button" onClick={() => setF(p => ({ ...p, event_type: f.event_type === t2 ? null : t2 }))}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{ backgroundColor: f.event_type === t2 ? 'var(--brand-teal)' : 'rgba(0,0,0,0.06)', color: f.event_type === t2 ? 'white' : 'var(--text-secondary)' }}>
                {t2}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.calendar.lbl.visibleTo')}</label>
          <div className="flex gap-2">
            {ALL_ROLES.map(role => (
              <button key={role} type="button" onClick={() => setF(p => ({
                ...p,
                visibility_roles: p.visibility_roles.includes(role)
                  ? p.visibility_roles.filter(r => r !== role)
                  : [...p.visibility_roles, role],
              }))}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{ backgroundColor: f.visibility_roles.includes(role) ? 'var(--brand-forest)' : 'rgba(0,0,0,0.06)', color: f.visibility_roles.includes(role) ? 'var(--brand-parchment)' : 'var(--text-secondary)' }}>
                {role}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Allow guest registration toggle */}
      <div>
        <label className="text-xs mb-2 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.calendar.lbl.allowGuestReg')}</label>
        <button
          type="button"
          onClick={() => setF(p => ({ ...p, allow_guest_registration: !p.allow_guest_registration }))}
          className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
          style={{
            backgroundColor: f.allow_guest_registration ? 'var(--brand-teal)' : 'rgba(0,0,0,0.06)',
            color: f.allow_guest_registration ? 'white' : 'var(--text-secondary)',
          }}>
          {f.allow_guest_registration ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Available roles tag manager */}
      <div>
        <label className="text-xs mb-2 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.calendar.lbl.availableRoles')}</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {f.available_roles.map(role => (
            <span key={role} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: 'var(--brand-forest)', color: 'var(--brand-parchment)' }}>
              {role}
              <button type="button" onClick={() => removeRole(role)}
                className="ml-0.5 leading-none hover:opacity-70 transition-opacity"
                style={{ color: 'var(--brand-parchment)' }}>
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={roleInput}
            onChange={e => setRoleInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRole() } }}
            placeholder={t('admin.calendar.placeholder.roleTag')}
            className="flex-1 border rounded-xl px-3 py-2 text-xs"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
          <button type="button" onClick={addRole}
            className="px-3 py-2 rounded-xl text-xs font-semibold border transition-colors hover:bg-black/5"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
            +
          </button>
        </div>
      </div>

      {formError && <p className="text-sm" style={{ color: 'var(--brand-crimson)' }}>{formError}</p>}
      <div className="flex gap-3 pt-2">
        <button onClick={onSave} disabled={isPending || !f.title || !f.start_time || !f.end_time}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--brand-crimson)' }}>
          {isPending ? t('admin.calendar.btn.saving') : label}
        </button>
        <button onClick={onCancel}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-black/5"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
          {t('admin.calendar.btn.cancel')}
        </button>
      </div>
    </div>
  )
}

// ── Pill hoisted to module scope to prevent remount on parent render ──────

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex-shrink-0"
      style={{
        backgroundColor: active ? 'var(--brand-forest)' : 'rgba(0,0,0,0.06)',
        color: active ? 'var(--brand-parchment)' : 'var(--text-secondary)',
      }}
    >
      {children}
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type TimeScope = 'upcoming' | 'past' | 'all'
type CategoryFilter = 'All' | 'N21' | 'Personal'

export default function AdminCalendarPage() {
  const qc = useQueryClient()
  const { t } = useLanguage()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<CalEvent | null>(null)
  const [form, setForm] = useState<EventFormState>(emptyForm())
  const [formError, setFormError] = useState<string | null>(null)

  // ── Filter state ──────────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All')
  const [timeScope, setTimeScope] = useState<TimeScope>('upcoming')
  const [monthFilter, setMonthFilter] = useState<string>('')

  const { data: events = [], isLoading } = useQuery<CalEvent[]>({
    queryKey: ['admin-calendar'],
    queryFn: () => fetch('/api/admin/calendar').then(r => r.json()),
  })

  // ── Derived filter options ────────────────────────────────────────────────
  const availableMonths = useMemo(() => {
    const seen = new Set<string>()
    const months: { value: string; label: string }[] = []
    for (const ev of events) {
      const d = new Date(ev.start_time)
      const value = d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' }).slice(0, 7)
      if (!seen.has(value)) {
        seen.add(value)
        months.push({
          value,
          label: d.toLocaleDateString('bg-BG', { month: 'long', year: 'numeric', timeZone: 'Europe/Sofia' }),
        })
      }
    }
    return months
  }, [events])

  // Reset month filter when time scope changes
  const handleTimeScopeChange = (scope: TimeScope) => {
    setTimeScope(scope)
    setMonthFilter('')
  }

  // ── Filtered events ───────────────────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    const now = new Date()
    return events.filter(ev => {
      // Search
      if (search && !ev.title.toLowerCase().includes(search.toLowerCase())) return false
      // Category
      if (categoryFilter !== 'All' && ev.category !== categoryFilter) return false
      // Time scope
      const start = new Date(ev.start_time)
      if (timeScope === 'upcoming' && start < now) return false
      if (timeScope === 'past' && start >= now) return false
      // Month
      if (monthFilter) {
        const evMonth = new Date(ev.start_time).toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' }).slice(0, 7)
        if (evMonth !== monthFilter) return false
      }
      return true
    })
  }, [events, search, categoryFilter, timeScope, monthFilter])

  const createMutation = useMutation({
    mutationFn: (body: EventFormState) =>
      fetch('/api/admin/calendar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizeFormTimes(body)),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-calendar'] })
      setDrawerOpen(false)
      setForm(emptyForm())
      setFormError(null)
    },
    onError: (e: Error) => setFormError(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & EventFormState) =>
      fetch(`/api/admin/calendar/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizeFormTimes(body)),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-calendar'] })
      setDrawerOpen(false)
      setEditing(null)
      setFormError(null)
    },
    onError: (e: Error) => setFormError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/admin/calendar/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-calendar'] }),
  })

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setFormError(null)
    setDrawerOpen(true)
  }

  function openEdit(ev: CalEvent) {
    setForm({
      title: ev.title,
      description: ev.description ?? '',
      start_time: toSofiaLocalInput(ev.start_time),
      end_time:   toSofiaLocalInput(ev.end_time),
      week_number: ev.week_number,
      category: ev.category,
      event_type: ev.event_type,
      visibility_roles: Array.isArray(ev.visibility_roles) ? ev.visibility_roles : [...ALL_ROLES],
      meeting_url: ev.meeting_url ?? '',
      allow_guest_registration: ev.allow_guest_registration,
      available_roles: Array.isArray(ev.available_roles)
        ? ev.available_roles
        : ['HOST', 'SPEAKER', 'PRODUCTS'],
    })
    setFormError(null)
    setEditing(ev)
    setDrawerOpen(true)
  }

  function handleClose() {
    setDrawerOpen(false)
    setEditing(null)
    setForm(emptyForm())
    setFormError(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('admin.calendar.pageTitle')}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {t('admin.calendar.pageDesc')}
          </p>
        </div>
        <button onClick={openCreate}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--brand-crimson)' }}>
          {t('admin.calendar.btn.new')}
        </button>
      </div>

      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <div className="space-y-2.5">
        {/* Row 1: search + month jump */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search events…"
              className="w-full border rounded-xl px-3 py-2 text-sm pr-8"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm leading-none hover:opacity-70"
                style={{ color: 'var(--text-secondary)' }}
              >
                ×
              </button>
            )}
          </div>
          <select
            value={monthFilter}
            onChange={e => setMonthFilter(e.target.value)}
            className="border rounded-xl px-3 py-2 text-sm"
            style={{ borderColor: 'var(--border-default)', color: monthFilter ? 'var(--text-primary)' : 'var(--text-secondary)', backgroundColor: 'var(--bg-card)' }}
          >
            <option value="">{t('admin.calendar.allMonths')}</option>
            {availableMonths.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Row 2: category + time scope */}
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex gap-1.5">
            {(['All', 'N21', 'Personal'] as CategoryFilter[]).map(c => (
              <Pill key={c} active={categoryFilter === c} onClick={() => setCategoryFilter(c)}>{c}</Pill>
            ))}
          </div>
          <div className="w-px h-4 flex-shrink-0" style={{ backgroundColor: 'var(--border-default)' }} />
          <div className="flex gap-1.5">
            {([
              { value: 'upcoming', label: 'Upcoming' },
              { value: 'past',     label: 'Past'     },
              { value: 'all',      label: 'All'      },
            ] as { value: TimeScope; label: string }[]).map(s => (
              <Pill key={s.value} active={timeScope === s.value} onClick={() => handleTimeScopeChange(s.value)}>
                {s.label}
              </Pill>
            ))}
          </div>
        </div>
      </div>

      {/* ── Event list ─────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--border-default)' }} />
          ))}
        </div>
      ) : filteredEvents.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {events.length === 0 ? t('admin.calendar.empty') : 'No events match the current filters.'}
        </p>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border-default)' }}>
          {filteredEvents.map((ev, i) => (
            <div key={ev.id} className="px-5 py-4 flex items-center gap-4"
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
                      {t('admin.calendar.badge.google')}
                    </span>
                  )}
                  {ev.meeting_url && (
                    <a href={ev.meeting_url} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] px-2 py-0.5 rounded-full hover:opacity-70 transition-opacity"
                      style={{ backgroundColor: 'rgba(62,119,133,0.12)', color: 'var(--brand-teal)' }}>
                      🔗
                    </a>
                  )}
                  {ev.allow_guest_registration && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'rgba(129,178,154,0.2)', color: '#2d6a4f' }}>
                      {t('admin.calendar.badge.guestReg')}
                    </span>
                  )}
                  {ev.available_roles?.map(role => (
                    <span key={role} className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}>
                      {role}
                    </span>
                  ))}
                </div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {formatDateTime(ev.start_time)} → {formatDateTime(ev.end_time)} · W{ev.week_number}
                  {' · '}{ev.visibility_roles.join(', ')}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <button onClick={() => openEdit(ev)}
                  className="text-xs hover:opacity-70 transition-opacity" style={{ color: 'var(--text-secondary)' }}>
                  {t('admin.calendar.btn.edit')}
                </button>
                <button onClick={() => { if (confirm(t('admin.calendar.confirm.delete').replace('{{title}}', ev.title))) deleteMutation.mutate(ev.id) }}
                  disabled={deleteMutation.isPending}
                  className="text-xs hover:opacity-70 transition-opacity disabled:opacity-30" style={{ color: 'var(--brand-crimson)' }}>
                  {t('admin.calendar.btn.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Drawer
        open={drawerOpen}
        onClose={handleClose}
        title={editing
          ? t('admin.calendar.drawer.editTitle').replace('{{title}}', editing.title)
          : t('admin.calendar.drawer.newTitle')
        }
      >
        <EventForm
          f={form}
          setF={setForm}
          onSave={() => editing ? updateMutation.mutate({ id: editing.id, ...form }) : createMutation.mutate(form)}
          onCancel={handleClose}
          isPending={createMutation.isPending || updateMutation.isPending}
          label={editing ? t('admin.calendar.btn.saveChanges') : t('admin.calendar.btn.createEvent')}
          formError={formError}
        />
      </Drawer>
    </div>
  )
}
