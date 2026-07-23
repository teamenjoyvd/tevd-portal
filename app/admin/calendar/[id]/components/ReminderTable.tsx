'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/apiClient'
import { useLanguage } from '@/lib/hooks/useLanguage'
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
import { Drawer } from '@/components/ui/drawer'

type Reminder = {
  id: string
  type: 'event_reminder_1h' | 'event_reminder_15m' | 'doc_expiry'
  send_at: string
  sent_at: string | null
  status: string
  registration_id: string | null
  guest_registrations: { name: string; email: string } | null
}

import { StatusPill } from '@/components/admin/StatusPill'
import { reminderLabelLong } from '@/components/admin/reminder-shared'

// ---------------------------------------------------------------------------
// EventRemindersToggle — hoisted to module scope
// ---------------------------------------------------------------------------
function EventRemindersToggle({ eventId, initialEnabled }: { eventId: string; initialEnabled: boolean }) {
  const { t } = useLanguage()
  const [enabled, setEnabled] = useState(initialEnabled)

  const toggleMutation = useMutation({
    mutationFn: (next: boolean) =>
      apiClient(`/api/admin/calendar/${eventId}`, {
        method: 'PATCH',
        body: JSON.stringify({ reminders_enabled: next }),
      }),
    onError: (_e, next) => setEnabled(!next),
  })

  function handleToggle() {
    const next = !enabled
    setEnabled(next)
    toggleMutation.mutate(next)
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {enabled ? t('admin.calendar.reminders.enabled') : t('admin.calendar.reminders.disabled')}
      </span>
      <button
        onClick={handleToggle}
        disabled={toggleMutation.isPending}
        aria-label={enabled ? t('admin.calendar.reminders.disableAria') : t('admin.calendar.reminders.enableAria')}
        className={[
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50',
          enabled ? 'bg-[#bc4749]' : 'bg-gray-300 dark:bg-gray-600',
        ].join(' ')}
      >
        <span className={[
          'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200',
          enabled ? 'translate-x-5' : 'translate-x-0',
        ].join(' ')} />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// RowActions — hoisted to module scope
// ---------------------------------------------------------------------------
function RowActions({ reminder, eventId }: { reminder: Reminder; eventId: string }) {
  const { t } = useLanguage()
  const qc = useQueryClient()
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [newSendAt, setNewSendAt] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const canCancelOrReschedule = reminder.status === 'pending' || reminder.status === 'failed'
  const canResend = reminder.status === 'sent' || reminder.status === 'permanently_failed'
  const guestName = reminder.guest_registrations?.name ?? t('admin.calendar.reminders.unnamedGuest')

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-calendar-reminders', eventId] })
  const onActionError = (e: Error) => setActionError(e.message)

  const cancelMutation = useMutation({
    mutationFn: () => apiClient(`/api/admin/reminders/${reminder.id}`, { method: 'DELETE' }),
    onSuccess: () => { setActionError(null); invalidate() },
    onError: onActionError,
  })
  const resendMutation = useMutation({
    mutationFn: () => apiClient(`/api/admin/reminders/${reminder.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'resend' }) }),
    onSuccess: () => { setActionError(null); invalidate() },
    onError: onActionError,
  })
  const rescheduleMutation = useMutation({
    mutationFn: (sendAt: string) =>
      apiClient(`/api/admin/reminders/${reminder.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'reschedule', send_at: sendAt }) }),
    onSuccess: () => { setActionError(null); setRescheduleOpen(false); invalidate() },
    onError: onActionError,
  })

  const pending = cancelMutation.isPending || resendMutation.isPending || rescheduleMutation.isPending

  function handleReschedule() {
    if (!newSendAt) return
    rescheduleMutation.mutate(new Date(newSendAt).toISOString())
  }

  return (
    <div className="flex items-center gap-2">
      {canCancelOrReschedule && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              disabled={pending}
              className="text-xs px-2 py-1 rounded border transition-colors hover:bg-black/5 disabled:opacity-50"
              style={{ borderColor: 'var(--border-default)', color: 'var(--brand-crimson)' }}
            >
              {t('admin.calendar.reminders.btn.cancel')}
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('admin.calendar.reminders.confirm.cancelTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('admin.calendar.reminders.confirm.cancelDesc').replace('{{guest}}', guestName)}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('admin.calendar.reminders.confirm.keepIt')}</AlertDialogCancel>
              <AlertDialogAction onClick={() => cancelMutation.mutate()}>
                {t('admin.calendar.reminders.confirm.yesCancel')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {canResend && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              disabled={pending}
              className="text-xs px-2 py-1 rounded border transition-colors hover:bg-black/5 disabled:opacity-50"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
            >
              {t('admin.calendar.reminders.btn.resend')}
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('admin.calendar.reminders.confirm.resendTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('admin.calendar.reminders.confirm.resendDesc')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('admin.calendar.btn.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={() => resendMutation.mutate()}>
                {t('admin.calendar.reminders.confirm.yesResend')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {canCancelOrReschedule && (
        <>
          <button
            disabled={pending}
            onClick={() => setRescheduleOpen(true)}
            className="text-xs px-2 py-1 rounded border transition-colors hover:bg-black/5 disabled:opacity-50"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            {t('admin.calendar.reminders.btn.reschedule')}
          </button>
          <Drawer open={rescheduleOpen} onClose={() => setRescheduleOpen(false)} title={t('admin.calendar.reminders.reschedule.title')}>
            <div className="space-y-4">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {t('admin.calendar.reminders.reschedule.desc')
                  .replace('{{guest}}', guestName)
                  .replace('{{type}}', reminderLabelLong(t, reminder.type))}
              </p>
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {t('admin.calendar.reminders.reschedule.lbl')}
                </label>
                <input
                  type="datetime-local"
                  value={newSendAt}
                  onChange={e => setNewSendAt(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                  style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setRescheduleOpen(false)}
                  className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5"
                  style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                >
                  {t('admin.calendar.btn.cancel')}
                </button>
                <button
                  onClick={handleReschedule}
                  disabled={!newSendAt || pending}
                  className="flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: '#bc4749' }}
                >
                  {rescheduleMutation.isPending ? t('admin.calendar.reminders.reschedule.saving') : t('admin.calendar.reminders.reschedule.save')}
                </button>
              </div>
            </div>
          </Drawer>
        </>
      )}
      {actionError && <p className="text-xs" style={{ color: 'var(--brand-crimson)' }}>{actionError}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ReminderTable — main export
// ---------------------------------------------------------------------------
export default function ReminderTable({
  reminders: initialReminders,
  eventId,
  remindersEnabled,
}: {
  reminders: Reminder[]
  eventId: string
  remindersEnabled: boolean
}) {
  const { t } = useLanguage()
  const { data: reminders = [] } = useQuery<Reminder[]>({
    queryKey: ['admin-calendar-reminders', eventId],
    queryFn: () => apiClient(`/api/admin/calendar/${eventId}/reminders`),
    initialData: initialReminders,
  })

  return (
    <div className="space-y-4">
      <EventRemindersToggle eventId={eventId} initialEnabled={remindersEnabled} />

      {reminders.length === 0 ? (
        <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>
          {t('admin.calendar.reminders.empty')}
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: 'var(--bg-card)' }}>
                <tr className="text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                  <th className="px-4 py-3">{t('admin.calendar.reminders.col.guest')}</th>
                  <th className="px-4 py-3">{t('admin.calendar.reminders.col.email')}</th>
                  <th className="px-4 py-3">{t('admin.calendar.reminders.col.type')}</th>
                  <th className="px-4 py-3">{t('admin.calendar.reminders.col.sendAt')}</th>
                  <th className="px-4 py-3">{t('admin.calendar.reminders.col.status')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {reminders.map((r) => (
                  <tr key={r.id} style={{ backgroundColor: 'var(--bg-card)' }}>
                    <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>{r.guest_registrations?.name ?? '—'}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{r.guest_registrations?.email ?? '—'}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{reminderLabelLong(t, r.type)}</td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      {new Date(r.send_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                    <td className="px-4 py-3"><RowActions reminder={r} eventId={eventId} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {reminders.map((r) => (
              <div key={r.id} className="rounded-lg border p-4 space-y-2" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{r.guest_registrations?.name ?? '—'}</span>
                  <StatusPill status={r.status} />
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.guest_registrations?.email ?? '—'}</p>
                <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span>{reminderLabelLong(t, r.type)}</span>
                  <span className="tabular-nums">{new Date(r.send_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <RowActions reminder={r} eventId={eventId} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
