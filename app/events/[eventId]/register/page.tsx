import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { RegisterForm } from './components/RegisterForm'

type Props = { params: Promise<{ eventId: string }> }

export default async function GuestRegisterPage({ params }: Props) {
  const { eventId } = await params
  const supabase = createServiceClient()

  const { data: event } = await supabase
    .from('calendar_events')
    .select('id, title, start_time, allow_guest_registration')
    .eq('id', eventId)
    .single()

  if (!event || !event.allow_guest_registration) notFound()

  const dateLabel = new Date(event.start_time).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <>
      {/* ── Desktop ────────────────────────────────────────────────────────── */}
      <div
        className="hidden md:flex min-h-screen items-center justify-center px-6"
        style={{ backgroundColor: 'var(--bg-global, #f4f1eb)' }}
      >
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#bc4749' }}>
              TeamEnjoyVD
            </p>
            <h1 className="font-display text-2xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              {event.title}
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{dateLabel}</p>
          </div>
          <div
            className="rounded-2xl border p-8"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
          >
            <p className="text-sm font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>
              Register to get your access link
            </p>
            <RegisterForm eventId={event.id} eventTitle={event.title} />
          </div>
        </div>
      </div>

      {/* ── Mobile ─────────────────────────────────────────────────────────── */}
      <div
        className="md:hidden min-h-screen px-5 pt-12 pb-8"
        style={{ backgroundColor: 'var(--bg-global, #f4f1eb)' }}
      >
        <div className="mb-8">
          <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#bc4749' }}>
            TeamEnjoyVD
          </p>
          <h1 className="font-display text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            {event.title}
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{dateLabel}</p>
        </div>
        <div
          className="rounded-2xl border p-5"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
        >
          <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Register to get your access link
          </p>
          <RegisterForm eventId={event.id} eventTitle={event.title} />
        </div>
      </div>
    </>
  )
}
