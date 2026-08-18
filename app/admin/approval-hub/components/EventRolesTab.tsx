'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from '@/lib/toast'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { formatDate, formatTime } from '@/lib/format'
import { fetchJson } from '@/lib/utils/fetchJson'
import { ApiError } from '@/lib/api-error'
import type { TranslationKey } from '@/lib/i18n'

// ── Types ────────────────────────────────────────────────────────

type CalendarEvent = { id: string; title: string; start_time: string }

type RoleRequest = {
  id: string
  role_label: string
  status: 'pending' | 'approved' | 'denied' | 'cancelled'
  note: string | null
  created_at: string
  event_id: string
  slot_status: 'open' | 'contested' | 'filled'
  profile: {
    id: string
    first_name: string | null
    last_name: string | null
    abo_number: string | null
    contact_email: string | null
  }
  event: CalendarEvent | null
}

// ── Helpers ──────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  pending:  'bg-status-pending-bg text-status-pending-fg border border-status-pending-fg/30',
  approved: 'bg-status-success-bg text-status-success-fg border border-status-success-fg/50',
  denied:   'bg-brand-crimson/10 text-status-alert-fg border border-status-alert-fg/30',
  // 2608-DEV-749 — neutral grey: a revoked role is an administrative change,
  // not a rejection. Same shape as the entries above it.
  cancelled: 'bg-hover-surface text-[var(--text-secondary)] border border-border-default',
}

// The badge used to render the raw enum value, so an admin on Bulgarian read
// "cancelled". Keyed on the same union as RoleRequest['status'], so adding a
// status to that type fails the build here until a label exists for it.
const STATUS_LABEL: Record<RoleRequest['status'], TranslationKey> = {
  pending:   'admin.approval.events.status.pending',
  approved:  'admin.approval.events.status.approved',
  denied:    'admin.approval.events.status.denied',
  cancelled: 'admin.approval.events.status.cancelled',
}

const SLOT_BADGE: Record<string, string> = {
  open:      'bg-hover-surface text-[var(--text-secondary)]',
  contested: 'bg-status-pending-bg text-status-pending-fg border border-status-pending-fg/30',
  filled:    'bg-status-success-bg text-status-success-fg border border-status-success-fg/50',
}

function requesterName(r: RoleRequest): { primary: string; secondary: string | null } {
  const first = r.profile.first_name?.trim() ?? ''
  const last  = r.profile.last_name?.trim() ?? ''
  const name  = [first, last].filter(Boolean).join(' ')
  if (name) return { primary: name, secondary: r.profile.contact_email }
  return { primary: r.profile.contact_email ?? r.profile.abo_number ?? '—', secondary: null }
}

function CollapsibleResolved({ children, count }: { children: React.ReactNode; count: number }) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  if (count === 0) return null
  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase mb-3 hover:opacity-70 transition-opacity"
        style={{ color: 'var(--text-secondary)' }}
      >
        <span>{t('admin.approval.trips.resolvedCollapsible').replace('{{count}}', String(count))}</span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && <div className="space-y-2">{children}</div>}
    </div>
  )
}

// ── Component: Event Roles ───────────────────────────────────────

export function EventRolesTab() {
  const { t } = useLanguage()
  const qc = useQueryClient()
  const [filterEventId, setFilterEventId] = useState<string>('all')

  const { data: roleRequests = [], isLoading } = useQuery<RoleRequest[]>({
    queryKey: ['role-requests', 'all'],
    queryFn: () => fetchJson<RoleRequest[]>('/api/admin/event-role-requests'),
  })

  const eventsWithRequests = Array.from(
    new Map(
      roleRequests
        .map(r => [r.event_id, r.event] as [string, CalendarEvent | null])
        .filter((entry): entry is [string, CalendarEvent] => entry[1] !== null)
    ).values()
  )

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'denied' | 'cancelled' }) =>
      fetchJson(`/api/admin/event-role-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['role-requests', 'all'] })
      const prev = qc.getQueryData<RoleRequest[]>(['role-requests', 'all'])
      qc.setQueryData<RoleRequest[]>(['role-requests', 'all'], old =>
        old?.map(r => r.id === id ? { ...r, status } : r)
      )
      return { prev }
    },
    // Same code-keyed branching the calendar popup uses (2608-DEV-733): switch on
    // the route's `code`, never on `message`, which is English developer copy.
    // Until 2608-DEV-751 `fetchJson` threw a bare Error, so the code was lost and
    // every failure — including a 409 `state_changed` — showed one hardcoded
    // English string.
    onError: (err: unknown, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['role-requests', 'all'], ctx.prev)
      const code = err instanceof ApiError ? err.code : undefined
      toast.error(t(code === 'state_changed'
        ? 'admin.approval.events.stateChanged'
        : 'admin.approval.events.updateError'))
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['role-requests', 'all'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const filtered = filterEventId === 'all'
    ? roleRequests
    : roleRequests.filter(r => r.event_id === filterEventId)

  const pending  = filtered.filter(r => r.status === 'pending')
  const resolved = filtered.filter(r => r.status !== 'pending')

  function eventMeta(r: RoleRequest): string {
    const title = r.event?.title ?? r.event_id
    const date  = r.event?.start_time ? ` · ${formatDate(r.event.start_time)}` : ''
    return `${title}${date}`
  }

  return (
    <div>
      {/* Scroll rail rather than a wrapping wall: recurring Google-synced
          events share a title, so an unbounded wrap stacks many rows deep
          at 390px. The date in each label is what makes them distinct. */}
      {eventsWithRequests.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-5" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => setFilterEventId('all')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0"
            style={{
              backgroundColor: filterEventId === 'all' ? 'var(--text-primary)' : 'var(--hover-surface)',
              color: filterEventId === 'all' ? 'var(--bg-global)' : 'var(--text-secondary)',
            }}
          >
            {t('admin.approval.events.btn.allEvents')}
          </button>
          {eventsWithRequests.map(e => (
            <button
              key={e.id}
              onClick={() => setFilterEventId(e.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors max-w-[200px] flex-shrink-0 inline-flex items-center gap-1"
              style={{
                backgroundColor: filterEventId === e.id ? 'var(--text-primary)' : 'var(--hover-surface)',
                color: filterEventId === e.id ? 'var(--bg-global)' : 'var(--text-secondary)',
              }}
            >
              {/* Title truncates, date does not: recurring Google-synced events
                  share a title, so the date is the only thing that tells the
                  chips apart — truncating the whole label can hide it. */}
              <span className="min-w-0 truncate">{e.title}</span>
              {e.start_time !== '' && <span className="flex-shrink-0">· {formatDate(e.start_time)}</span>}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>
        {t('admin.approval.trips.pendingTitle').replace('{{count}}', String(pending.length))}
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-hover-surface rounded-xl animate-pulse" />)}
        </div>
      ) : pending.length === 0 ? (
        <div className="rounded-xl border px-5 py-8 text-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('admin.approval.events.noPending')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pending.map(r => {
            const { primary, secondary } = requesterName(r)
            return (
              <div key={r.id} className="rounded-xl border px-4 py-3.5" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {primary}
                        {r.profile.abo_number && (
                          <span className="font-normal text-xs ml-1.5" style={{ color: 'var(--text-secondary)' }}>
                            {r.profile.abo_number}
                          </span>
                        )}
                      </p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${SLOT_BADGE[r.slot_status]}`}>
                        {r.slot_status}
                      </span>
                    </div>
                    {secondary && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{secondary}</p>
                    )}
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{r.role_label}</span>
                      {' · '}{eventMeta(r)}
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                      {formatDate(r.created_at)}{r.event?.start_time ? ` · ${formatTime(r.event.start_time)}` : ''}
                    </p>
                    {r.note && (
                      <p className="text-xs mt-1 italic" style={{ color: 'var(--text-secondary)' }}>
                        &quot;{r.note}&quot;
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 sm:flex-shrink-0">
                    <button
                      onClick={() => updateMutation.mutate({ id: r.id, status: 'approved' })}
                      disabled={updateMutation.isPending}
                      className="flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-sm font-medium text-on-accent disabled:opacity-50"
                      style={{ backgroundColor: 'var(--brand-teal)' }}
                    >
                      {t('admin.approval.verify.btn.approve')}
                    </button>
                    <button
                      onClick={() => updateMutation.mutate({ id: r.id, status: 'denied' })}
                      disabled={updateMutation.isPending}
                      className="flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
                      style={{ backgroundColor: 'var(--hover-surface)', color: 'var(--text-primary)' }}
                    >
                      {t('admin.approval.verify.btn.deny')}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <CollapsibleResolved count={resolved.length}>
        {resolved.map(r => {
          const { primary, secondary } = requesterName(r)
          return (
            <div key={r.id} className="rounded-xl border px-4 py-3 flex items-center justify-between gap-3" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
              <div className="min-w-0">
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {primary}
                  {' · '}
                  <span className="font-medium">{r.role_label}</span>
                </p>
                {secondary && (
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{secondary}</p>
                )}
                <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
                  {eventMeta(r)}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_BADGE[r.status]}`}>
                  {t(STATUS_LABEL[r.status])}
                </span>
                {/* 2608-DEV-749: an approved role was read-only here, so nobody
                    could undo it. Behind a confirm — it emails the member and
                    reopens the slot. */}
                {r.status === 'approved' && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        disabled={updateMutation.isPending}
                        className="text-xs font-medium hover:opacity-70 transition-opacity disabled:opacity-40"
                        style={{ color: 'var(--status-alert-fg)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        {t('admin.approval.events.btn.revoke')}
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('admin.approval.events.revokeTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>{t('admin.approval.events.revokeDesc')}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('event.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => updateMutation.mutate({ id: r.id, status: 'cancelled' })}>
                          {t('admin.approval.events.btn.revoke')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          )
        })}
      </CollapsibleResolved>
    </div>
  )
}
