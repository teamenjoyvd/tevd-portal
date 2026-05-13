'use client'

import { Tables } from '@/types/supabase'

type Reminder = Tables<'scheduled_reminders'> & {
  guest_registrations: { name: string; email: string } | null
}

const REMINDER_LABEL: Record<string, string> = {
  '1_hour': '1 hour before',
  '15_min': '15 min before',
}

function StatusPill({ sent }: { sent: boolean }) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        sent
          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      ].join(' ')}
    >
      {sent ? 'Sent' : 'Pending'}
    </span>
  )
}

export default function ReminderTable({ reminders }: { reminders: Reminder[] }) {
  if (reminders.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)] py-6 text-center">
        No reminders scheduled for this event.
      </p>
    )
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-card)]">
            <tr className="text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
              <th className="px-4 py-3">Guest</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Send at</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {reminders.map((r) => (
              <tr key={r.id} className="bg-[var(--bg-card)] hover:bg-[var(--bg-hover)]">
                <td className="px-4 py-3 text-[var(--text-primary)]">
                  {r.guest_registrations?.name ?? '—'}
                </td>
                <td className="px-4 py-3 text-[var(--text-muted)]">
                  {r.guest_registrations?.email ?? '—'}
                </td>
                <td className="px-4 py-3 text-[var(--text-secondary)]">
                  {REMINDER_LABEL[r.reminder_type] ?? r.reminder_type}
                </td>
                <td className="px-4 py-3 text-[var(--text-muted)] tabular-nums">
                  {new Date(r.send_at).toLocaleString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="px-4 py-3">
                  <StatusPill sent={!!r.sent_at} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {reminders.map((r) => (
          <div
            key={r.id}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-sm text-[var(--text-primary)] truncate">
                {r.guest_registrations?.name ?? '—'}
              </span>
              <StatusPill sent={!!r.sent_at} />
            </div>
            <p className="text-xs text-[var(--text-muted)] truncate">
              {r.guest_registrations?.email ?? '—'}
            </p>
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span>{REMINDER_LABEL[r.reminder_type] ?? r.reminder_type}</span>
              <span className="tabular-nums">
                {new Date(r.send_at).toLocaleString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
