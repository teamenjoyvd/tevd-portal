import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ReminderTable from './components/ReminderTable'

export default async function AdminCalendarEventPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: event } = await supabase
    .from('calendar_events')
    .select('id, title, start_time')
    .eq('id', id)
    .single()

  if (!event) notFound()

  const { data: reminders } = await supabase
    .from('scheduled_reminders')
    .select(
      `id, reminder_type, send_at, sent_at,
       registration_id,
       guest_registrations ( name, email )`,
    )
    .eq('event_id', id)
    .order('send_at', { ascending: true })

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Desktop header */}
      <div className="hidden md:block">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">
          {event.title}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Scheduled reminders
        </p>
      </div>

      {/* Mobile header */}
      <div className="md:hidden">
        <h1 className="text-base font-semibold text-[var(--text-primary)] leading-tight">
          {event.title}
        </h1>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">Reminders</p>
      </div>

      <ReminderTable reminders={reminders ?? []} />
    </div>
  )
}
