'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDateTime, toSofiaLocalInput } from '@/lib/format'
import { Drawer } from '@/components/ui/drawer'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { EventForm, emptyForm, normalizeFormTimes, ALL_ROLES, DEFAULT_AVAILABLE_ROLES, type EventFormState } from './EventForm'
import { Pill } from './Pill'

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

type TimeScope = 'upcoming' | 'past' | 'all'
type CategoryFilter = 'All' | 'N21' | 'Personal'

export default function AdminCalendarClient() {
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
    queryFn: () => fetch('/api/admin/calendar').then(async r => { if (!r.ok) throw new Error('Failed to fetch events'); return r.json() }),
  })

  // ── Derived filter options ────────────────────────────────────────────────
  const availableMonths = useMemo(() => {
    const seen = new Set<string>()
    const months: { value: string; label: string }[] = []
    for (const ev of events) {
      const value = toSofiaLocalInput(ev.start_time).slice(0, 7)
      if (!seen.has(value)) {
        seen.add(value)
        const d = new Date(ev.start_time)
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
  const now = new Date()
  const filteredEvents = useMemo(() => {
    return events.filter(ev => {
      if (search && !ev.title.toLowerCase().includes(search.toLowerCase())) return false
      if (categoryFilter !== 'All' && ev.category !== categoryFilter) return false
      const start = new Date(ev.start_time)
      if (timeScope === 'upcoming' && start < now) return false
      if (timeScope === 'past' && start >= now) return false
      if (monthFilter) {
        const evMonth = toSofiaLocalInput(ev.start_time).slice(0, 7)
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
    mutationFn: (id: string) => fetch(`/api/admin/calendar/${id}`, { method: 'DELETE' }).then(async r => { if (!r.ok) throw new Error('Failed to delete event'); return r.json() }),
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
        : [...DEFAULT_AVAILABLE_ROLES],
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
              style={{ borderTop: i > 0 ? '1px solid var(--border-default)' : 'none', backgroundColor: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-global)' }}>
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
