'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Database } from '@/types/supabase'
import {
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

type Reminder = {
  id: string
  reminder_type: Database['public']['Enums']['reminder_type']
  send_at: string
  sent_at: string | null
  registration_id: string
  guest_registrations: { name: string; email: string } | null
}

const REMINDER_LABEL: Record<string, string> = {
  '1_hour': '1 hour before',
  '15_min': '15 min before',
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
// EventRemindersToggle — hoisted to module scope
// ---------------------------------------------------------------------------
function EventRemindersToggle({ eventId, initialEnabled }: { eventId: string; initialEnabled: boolean }) {
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
    <div className="flex items-center gap-3">
      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Reminders {enabled ? 'enabled' : 'disabled'}</span>
      <button
        onClick={handleToggle}
        disabled={pending}
        aria-label={enabled ? 'Disable reminders' : 'Enable reminders'}
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
function RowActions({ reminder }: { reminder: Reminder }) {
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
                <strong>{reminder.guest_registrations?.name ?? 'this guest'}</strong>.
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
        <>
          <button
            disabled={pending}
            onClick={() => setRescheduleOpen(true)}
            className="text-xs px-2 py-1 rounded border transition-colors hover:bg-black/5 disabled:opacity-50"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            Reschedule
          </button>
          <Drawer open={rescheduleOpen} onClose={() => setRescheduleOpen(false)} title="Reschedule reminder">
            <div className="space-y-4">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                New send time for <strong>{reminder.guest_registrations?.name ?? 'this guest'}</strong>&apos;s{' '}
                {REMINDER_LABEL[reminder.reminder_type]} reminder.
              </p>
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>New send time</label>
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
                  Cancel
                </button>
                <button
                  onClick={handleReschedule}
                  disabled={!newSendAt || pending}
                  className="flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
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
// ReminderTable — main export
// ---------------------------------------------------------------------------
export default function ReminderTable({
  reminders,
  eventId,
  remindersEnabled,
}: {
  reminders: Reminder[]
  eventId: string
  remindersEnabled: boolean
}) {
  return (
    <div className="space-y-4">
      <EventRemindersToggle eventId={eventId} initialEnabled={remindersEnabled} />

      {reminders.length === 0 ? (
        <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>
          No reminders scheduled for this event.
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: 'var(--bg-card)' }}>
                <tr className="text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                  <th className="px-4 py-3">Guest</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Send at</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {reminders.map((r) => (
                  <tr key={r.id} style={{ backgroundColor: 'var(--bg-card)' }}>
                    <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>{r.guest_registrations?.name ?? '—'}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{r.guest_registrations?.email ?? '—'}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{REMINDER_LABEL[r.reminder_type] ?? r.reminder_type}</td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      {new Date(r.send_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3"><StatusPill sent={!!r.sent_at} /></td>
                    <td className="px-4 py-3"><RowActions reminder={r} /></td>
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
                  <StatusPill sent={!!r.sent_at} />
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.guest_registrations?.email ?? '—'}</p>
                <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span>{REMINDER_LABEL[r.reminder_type] ?? r.reminder_type}</span>
                  <span className="tabular-nums">{new Date(r.send_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <RowActions reminder={r} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
