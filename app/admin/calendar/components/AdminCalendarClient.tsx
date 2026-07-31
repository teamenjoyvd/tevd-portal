'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/apiClient'
import { formatDateTime, toSofiaLocalInput } from '@/lib/format'
import { Drawer } from '@/components/ui/drawer'
import { useLanguage } from '@/lib/hooks/useLanguage'
import type { TranslationKey } from '@/lib/i18n/translations'
import { ALL_ROLES } from '@/lib/roles'
import type { AdminCalendarEvent } from '@/types/calendar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { EventForm, emptyForm, DEFAULT_AVAILABLE_ROLES, type EventFormState } from './EventForm'
import { useAdminCalendarMutations } from './useAdminCalendarMutations'
import { Pill } from './Pill'

// Tracked fields (kept in sync with lib/notifications/guest-event-changes.ts
// TRACKED_FIELDS) whose change should surface the "N registered guests will
// be notified" confirm.
function hasTrackedChange(ev: AdminCalendarEvent, f: EventFormState): boolean {
  return (
    toSofiaLocalInput(ev.start_time) !== f.start_time ||
    toSofiaLocalInput(ev.end_time) !== f.end_time ||
    (ev.meeting_url ?? '') !== f.meeting_url
  )
}

type TimeScope = 'upcoming' | 'past' | 'all'
type CategoryFilter = 'All' | 'N21' | 'Personal'

export default function AdminCalendarClient() {
  const { t } = useLanguage()
  const { syncMutation, createMutation, updateMutation, deleteMutation } = useAdminCalendarMutations()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<AdminCalendarEvent | null>(null)
  const [form, setForm] = useState<EventFormState>(emptyForm())
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminCalendarEvent | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [editConfirmOpen, setEditConfirmOpen] = useState(false)

  // ── Filter state ────────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All')
  const [timeScope, setTimeScope] = useState<TimeScope>('upcoming')
  const [monthFilter, setMonthFilter] = useState<string>('')

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(value), 300)
  }, [])

  const clearSearch = useCallback(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    setSearch('')
    setDebouncedSearch('')
  }, [])

  const { data: events = [], isLoading } = useQuery<AdminCalendarEvent[]>({
    queryKey: ['admin-calendar', debouncedSearch, categoryFilter, timeScope],
    queryFn: () => {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (categoryFilter !== 'All') params.set('category', categoryFilter)
      params.set('timeScope', timeScope)
      return apiClient<AdminCalendarEvent[]>(`/api/admin/calendar?${params.toString()}`)
    },
  })

  // ── Derived filter options (reflects search/category/time scope, not the month pick itself,
  // so picking a month doesn't collapse the dropdown down to that one option) ─────────────
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

  // Month filtering stays client-side: `events` is already bounded server-side by
  // search/category/timeScope, so slicing it further by month here is cheap.
  const displayEvents = useMemo(() => {
    if (!monthFilter) return events
    return events.filter(ev => toSofiaLocalInput(ev.start_time).slice(0, 7) === monthFilter)
  }, [events, monthFilter])

  // Reset month filter when time scope changes
  const handleTimeScopeChange = (scope: TimeScope) => {
    setTimeScope(scope)
    setMonthFilter('')
  }

  const { data: syncStatus, isError: syncStatusIsError } = useQuery<{ last_synced_at: string; ok: boolean; error: string | null } | null>({
    queryKey: ['admin-calendar-sync-status'],
    queryFn: () => apiClient('/api/admin/calendar-sync'),
    refetchInterval: 60_000,
  })

  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const syncStatusLabel = useMemo(() => {
    if (syncStatusIsError) return t('admin.calendar.sync.unavailable')
    if (!syncStatus) return null
    if (syncStatus.ok !== true) return t('admin.calendar.sync.failed').replace('{{error}}', syncStatus.error ?? t('admin.calendar.sync.unknownError'))
    if (now === null) return null
    const minsAgo = Math.max(0, Math.round((now - new Date(syncStatus.last_synced_at).getTime()) / 60_000))
    const time = minsAgo < 1 ? t('admin.calendar.sync.justNow') : t('admin.calendar.sync.minAgo').replace('{{n}}', String(minsAgo))
    return t('admin.calendar.sync.lastSync').replace('{{time}}', time)
  }, [syncStatus, syncStatusIsError, now, t])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setFormError(null)
    setDrawerOpen(true)
  }

  function openEdit(ev: AdminCalendarEvent) {
    setForm({
      title: ev.title,
      description: ev.description ?? '',
      start_time: toSofiaLocalInput(ev.start_time),
      end_time:   toSofiaLocalInput(ev.end_time),
      week_number: ev.week_number,
      category: ev.category,
      event_type: ev.event_type,
      access_roles: Array.isArray(ev.access_roles) ? ev.access_roles : [...ALL_ROLES],
      meeting_url: ev.meeting_url ?? '',
      allow_guest_registration: ev.allow_guest_registration,
      guest_capacity: ev.guest_capacity,
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
    setEditConfirmOpen(false)
  }

  function performSave() {
    const onSuccess = () => {
      setDrawerOpen(false)
      setEditing(null)
      setForm(emptyForm())
      setFormError(null)
    }
    const onError = (e: Error) => setFormError(e.message)
    if (editing) updateMutation.mutate({ id: editing.id, ...form }, { onSuccess, onError })
    else createMutation.mutate(form, { onSuccess, onError })
  }

  function handleSaveClick() {
    if (editing && (editing.guest_registration_count ?? 0) > 0 && hasTrackedChange(editing, form)) {
      setEditConfirmOpen(true)
      return
    }
    performSave()
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
        <div className="flex items-center gap-2">
          {syncStatusLabel && (
            <span
              className="text-xs hidden sm:inline"
              style={{ color: syncStatusIsError || syncStatus?.ok === false ? 'var(--brand-crimson)' : 'var(--text-secondary)' }}
            >
              {syncStatusLabel}
            </span>
          )}
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.status !== 'idle'}
            aria-label="Sync calendar"
            className="p-2 rounded-xl border transition-colors disabled:opacity-40"
            style={{
              borderColor: syncMutation.isError ? 'var(--brand-crimson)' : 'var(--border-default)',
              color: syncMutation.isError ? 'var(--brand-crimson)' : syncMutation.isSuccess ? 'var(--brand-forest)' : 'var(--text-secondary)',
              backgroundColor: 'var(--bg-card)',
            }}
          >
            <RefreshCw
              size={15}
              className={syncMutation.isPending ? 'animate-spin' : ''}
            />
          </button>
          <button onClick={openCreate}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'var(--brand-crimson)' }}>
            {t('admin.calendar.btn.new')}
          </button>
        </div>
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────────────────────── */}
      <div className="space-y-2.5">
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <input
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder={t('admin.calendar.searchPlaceholder')}
              className="w-full border rounded-xl px-3 py-2 text-sm pr-8"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
            />
            {search && (
              <button
                type="button"
                onClick={clearSearch}
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
          <div className="flex gap-1.5 flex-wrap">
            {(['All', 'N21', 'Personal'] as CategoryFilter[]).map(c => (
              <Pill key={c} active={categoryFilter === c} onClick={() => setCategoryFilter(c)}>{c}</Pill>
            ))}
          </div>
          <div className="w-px h-4 flex-shrink-0" style={{ backgroundColor: 'var(--border-default)' }} />
          <div className="flex gap-1.5 flex-wrap">
            {([
              { value: 'upcoming', key: 'admin.calendar.timeScope.upcoming' },
              { value: 'past',     key: 'admin.calendar.timeScope.past'     },
              { value: 'all',      key: 'admin.calendar.timeScope.all'      },
            ] as { value: TimeScope; key: TranslationKey }[]).map(s => (
              <Pill key={s.value} active={timeScope === s.value} onClick={() => handleTimeScopeChange(s.value)}>
                {t(s.key)}
              </Pill>
            ))}
          </div>
        </div>
      </div>

      {/* ── Event list ──────────────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--border-default)' }} />
          ))}
        </div>
      ) : displayEvents.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {events.length === 0 ? t('admin.calendar.empty') : t('admin.calendar.noMatches')}
        </p>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border-default)' }}>
          {displayEvents.map((ev, i) => (
            <div key={ev.id} className="px-5 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4"
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
                  {' · '}{(ev.access_roles ?? []).join(', ')}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <button onClick={() => openEdit(ev)}
                  className="text-xs hover:opacity-70 transition-opacity" style={{ color: 'var(--text-secondary)' }}>
                  {t('admin.calendar.btn.edit')}
                </button>
                <button onClick={() => setDeleteTarget(ev)}
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
          onSave={handleSaveClick}
          onCancel={handleClose}
          isPending={createMutation.isPending || updateMutation.isPending}
          label={editing ? t('admin.calendar.btn.saveChanges') : t('admin.calendar.btn.createEvent')}
          formError={formError}
        />
      </Drawer>

      {/* ── Edit confirm: tracked fields changed on an event with active guests ── */}
      <AlertDialog open={editConfirmOpen} onOpenChange={setEditConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.calendar.confirm.editTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.calendar.confirm.editDesc')}{' '}
              {editing && (editing.guest_registration_count ?? 0) > 0 &&
                t('admin.calendar.confirm.guestWarning').replace('{{count}}', String(editing.guest_registration_count))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.calendar.btn.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setEditConfirmOpen(false); performSave() }}>
              {t('admin.calendar.btn.saveChanges')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete confirm ──────────────────────────────────────────────────── */}
      <AlertDialog open={deleteTarget != null} onOpenChange={open => { if (!open) { setDeleteTarget(null); setDeleteError(null) } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget && t('admin.calendar.confirm.delete').replace('{{title}}', deleteTarget.title)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.calendar.confirm.deleteDesc')}{' '}
              {deleteTarget && (deleteTarget.guest_registration_count ?? 0) > 0 &&
                t('admin.calendar.confirm.guestWarning').replace('{{count}}', String(deleteTarget.guest_registration_count))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p className="text-sm" style={{ color: 'var(--brand-crimson)' }}>{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.calendar.btn.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (!deleteTarget) return
                setDeleteError(null)
                deleteMutation.mutate(deleteTarget.id, {
                  onSuccess: () => setDeleteTarget(null),
                  onError: (e: Error) => setDeleteError(e.message),
                })
              }}
            >
              {t('admin.calendar.btn.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
