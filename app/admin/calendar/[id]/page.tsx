import { createServiceClient } from '@/lib/supabase/service'
import { notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import ReminderTable from './components/ReminderTable'

export default async function AdminCalendarEventPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { id } = await params
  const sb = createServiceClient()

  const { data: event } = await sb
    .from('calendar_events')
    .select('id, title, start_time, reminders_enabled')
    .eq('id', id)
    .single()

  if (!event) notFound()

  const { data: reminders } = await sb
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
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          {event.title}
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Scheduled reminders</p>
      </div>

      {/* Mobile header */}
      <div className="md:hidden">
        <h1 className="text-base font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
          {event.title}
        </h1>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>Reminders</p>
      </div>

      <ReminderTable
        reminders={reminders ?? []}
        eventId={id}
        remindersEnabled={event.reminders_enabled}
      />
    </div>
  )
}
