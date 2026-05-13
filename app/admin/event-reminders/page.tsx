import { createClient } from '@/lib/supabase/server'
import RemindersTable from './components/RemindersTable'

export default async function AdminEventRemindersPage() {
  const supabase = await createClient()

  const { data: reminders } = await supabase
    .from('scheduled_reminders')
    .select(
      `id, reminder_type, send_at, sent_at,
       event_id,
       calendar_events ( title, start_time ),
       guest_registrations ( name, email )`,
    )
    .order('send_at', { ascending: false })
    .limit(200)

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Desktop header */}
      <div className="hidden md:block">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">
          Event Reminders
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          All scheduled guest reminder emails across every event.
        </p>
      </div>

      {/* Mobile header */}
      <div className="md:hidden">
        <h1 className="text-base font-semibold text-[var(--text-primary)] leading-tight">
          Event Reminders
        </h1>
      </div>

      <RemindersTable reminders={reminders ?? []} />
    </div>
  )
}
