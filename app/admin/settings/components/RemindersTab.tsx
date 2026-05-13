'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  toggleGlobalReminder,
  toggleEventReminders,
  cancelReminder,
  resendReminder,
  rescheduleReminder,
} from '@/app/admin/actions/reminders'
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
import { Database } from '@/types/supabase'

type ReminderType = Database['public']['Enums']['reminder_type']

type ReminderRow = {
  id: string
  event_id: string
  reminder_type: ReminderType
  send_at: string
  sent_at: string | null
  calendar_events: { id: string; title: string; start_time: string; reminders_enabled: boolean } | null
  guest_registrations: { name: string; email: string } | null
}

type EventGroup = {
  id: string
  title: string
  start_time: string
  reminders_enabled: boolean
  reminders: ReminderRow[]
}

const REMINDER_LABEL: Record<string, string> = {
  '1_hour': '1 hr',
  '15_min': '15 min',
}

function StatusPill({ sent }: { sent: boolean }) {
  return (
    <span className={[
      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
      sent
        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    ].join(' ')}>
      {sent ? 'Sent' : 'Pending'}
    </span>
  )
}

// ---------------------------------------------------------------------------
// GlobalToggle — hoisted to module scope (admin forms gotcha)
// ---------------------------------------------------------------------------
function GlobalToggle({
  label,
  settingKey,
  initialEnabled,
}: {
  label: string
  settingKey: 'reminders_1hr_enabled' | 'reminders_15min_enabled'
  initialEnabled: boolean
}) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [pending, startTransition] = useTransition()

  function handleToggle() {
    const next = !enabled
    setEnabled(next)
    startTransition(() => {
      toggleGlobalReminder(settingKey, next)
    })
  }

  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</span>
      <button
        onClick={handleToggle}
        disabled={pending}
        aria-label={enabled ? 'Disable' : 'Enable'}
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
// EventToggle — hoisted to module scope
// ---------------------------------------------------------------------------
function EventToggle({ eventId, initialEnabled }: { eventId: string; initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [pending, startTransition] = useTransition()

  function handleToggle() {
    const next = !enabled
    setEnabled(next)
    startTransition(() => {
      toggleEventReminders(eventId, next)
    })
  }

  return (
    <button
      onClick={handleToggle}
      disabled={pending}
      aria-label={enabled ? 'Disable reminders for event' : 'Enable reminders for event'}
      className={[
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50',
        enabled ? 'bg-[#bc4749]' : 'bg-gray-300 dark:bg-gray-600',
      ].join(' ')}
    >
      <span className={[
        'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition duration-200',
        enabled ? 'translate-x-4' : 'translate-x-0',
      ].join(' ')} />
    </button>
  )
}

// ---------------------------------------------------------------------------
// ReminderRowActions — hoisted to module scope
// ---------------------------------------------------------------------------
function ReminderRowActions({ reminder }: { reminder: ReminderRow }) {
  const router = useRouter()
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [newSendAt, setNewSendAt] = useState('')
  const [pending, startTransition] = useTransition()
  const isSent = !!reminder.sent_at

  function handleCancel() {
    startTransition(async () => {
      await cancelReminder(reminder.id)
      router.refresh()
    })
  }

  function handleResend() {
    startTransition(async () => {
      await resendReminder(reminder.id)
      router.refresh()
    })
  }

  function handleReschedule() {
    if (!newSendAt) return
    startTransition(async () => {
      await rescheduleReminder(reminder.id, new Date(newSendAt).toISOString())
      setRescheduleOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-2">
      {!isSent && (
        // Cancel — pending only
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              disabled={pending}
              className="text-xs px-2 py-1 rounded border transition-colors hover:bg-black/5 disabled:opacity-50"
              style={{ borderColor: 'var(--border-default)', color: 'var(--brand-crimson)' }}
            >
              Cancel
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel reminder?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the pending reminder for{' '}
                <strong>{reminder.guest_registrations?.name ?? 'this guest'}</strong>. It cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction onClick={handleCancel}>Yes, cancel</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {isSent && (
        // Resend — sent only, needs confirm
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              disabled={pending}
              className="text-xs px-2 py-1 rounded border transition-colors hover:bg-black/5 disabled:opacity-50"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
            >
              Resend
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Resend reminder?</AlertDialogTitle>
              <AlertDialogDescription>
                The reminder will be queued to send immediately on the next cron run.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleResend}>Yes, resend</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {!isSent && (
        // Reschedule — pending only
        <>
          <button
            disabled={pending}
            onClick={() => setRescheduleOpen(true)}
            className="text-xs px-2 py-1 rounded border transition-colors hover:bg-black/5 disabled:opacity-50"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            Reschedule
          </button>
          <Drawer
            open={rescheduleOpen}
            onClose={() => setRescheduleOpen(false)}
            title="Reschedule reminder"
          >
            <div className="space-y-4">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Set a new send time for{' '}
                <strong>{reminder.guest_registrations?.name ?? 'this guest'}</strong>'s{' '}
                {REMINDER_LABEL[reminder.reminder_type]} reminder.
              </p>
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>New send time</label>
                <input
                  type="datetime-local"
                  value={newSendAt}
                  onChange={e => setNewSendAt(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setRescheduleOpen(false)}
                  className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5"
                  style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleReschedule}
                  disabled={!newSendAt || pending}
                  className="flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 transition-colors"
                  style={{ backgroundColor: '#bc4749' }}
                >
                  {pending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </Drawer>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// RemindersTab — main export
// ---------------------------------------------------------------------------
export interface RemindersTabProps {
  globalToggles: { reminders_1hr_enabled: boolean; reminders_15min_enabled: boolean }
  reminders: ReminderRow[]
}

export function RemindersTab({ globalToggles, reminders }: RemindersTabProps) {
  // Group reminders by event
  const eventMap = new Map<string, EventGroup>()
  for (const r of reminders) {
    const ev = r.calendar_events
    if (!ev) continue
    if (!eventMap.has(ev.id)) {
      eventMap.set(ev.id, { id: ev.id, title: ev.title, start_time: ev.start_time, reminders_enabled: ev.reminders_enabled, reminders: [] })
    }
    eventMap.get(ev.id)!.reminders.push(r)
  }
  const events = Array.from(eventMap.values())

  return (
    <div className="space-y-6">
      {/* Global toggle strip */}
      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-card)' }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>GLOBAL TOGGLES</h2>
        <div className="divide-y" style={{ borderColor: 'var(--border-default)' }}>
          <GlobalToggle
            label="1-hour reminders"
            settingKey="reminders_1hr_enabled"
            initialEnabled={globalToggles.reminders_1hr_enabled}
          />
          <GlobalToggle
            label="15-minute reminders"
            settingKey="reminders_15min_enabled"
            initialEnabled={globalToggles.reminders_15min_enabled}
          />
        </div>
      </div>

      {/* Per-event reminder table */}
      {events.length === 0 ? (
        <p className="text-sm text-center py-10" style={{ color: 'var(--text-secondary)' }}>No scheduled reminders.</p>
      ) : (
        <div className="space-y-6">
          {events.map(event => (
            <div key={event.id} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-default)' }}>
              {/* Event header */}
              <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-default)' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <Link
                    href={`/admin/calendar/${event.id}`}
                    className="text-sm font-semibold truncate hover:underline"
                    style={{ color: 'var(--brand-crimson)' }}
                  >
                    {event.title}
                  </Link>
                  <span className="text-xs shrink-0" style={{ color: 'var(--text-secondary)' }}>
                    {new Date(event.start_time).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <EventToggle eventId={event.id} initialEnabled={event.reminders_enabled} />
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-global)', borderBottom: '1px solid var(--border-default)' }}>
                      <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Guest</th>
                      <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Type</th>
                      <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Send at</th>
                      <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Status</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--border-default)' }}>
                    {event.reminders.map(r => (
                      <tr key={r.id} style={{ backgroundColor: 'var(--bg-card)' }}>
                        <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                          <div>{r.guest_registrations?.name ?? '—'}</div>
                          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{r.guest_registrations?.email ?? ''}</div>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{REMINDER_LABEL[r.reminder_type] ?? r.reminder_type}</td>
                        <td className="px-4 py-3 tabular-nums text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {new Date(r.send_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3"><StatusPill sent={!!r.sent_at} /></td>
                        <td className="px-4 py-3">
                          <ReminderRowActions reminder={r} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y" style={{ borderColor: 'var(--border-default)' }}>
                {event.reminders.map(r => (
                  <div key={r.id} className="p-4 space-y-2" style={{ backgroundColor: 'var(--bg-card)' }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{r.guest_registrations?.name ?? '—'}</span>
                      <StatusPill sent={!!r.sent_at} />
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{r.guest_registrations?.email ?? '—'}</p>
                    <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
                      <span>{REMINDER_LABEL[r.reminder_type] ?? r.reminder_type}</span>
                      <span className="tabular-nums">{new Date(r.send_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <ReminderRowActions reminder={r} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
