import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/service'
import { RegisterForm } from './components/RegisterForm'
import { t } from '@/lib/i18n'

type Props = {
  params:       Promise<{ eventId: string }>
  searchParams: Promise<{ share?: string }>
}

export default async function GuestRegisterPage({ params, searchParams }: Props) {
  const { eventId }  = await params
  const { share }    = await searchParams
  const supabase     = createServiceClient()

  const cookieStore = await cookies()
  const lang = cookieStore.get('tevd_lang')?.value === 'bg' ? 'bg' : 'en'

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
              {t('event.join.brandName', lang)}
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
              {t('event.register.registerToGet', lang)}
            </p>
            <RegisterForm eventId={event.id} eventTitle={event.title} shareToken={share} />
          </div>
        </div>
      </div>

      {/* ── Mobile ──────────────────────────────────────────────────────────── */}
      <div
        className="md:hidden min-h-screen px-5 pt-12 pb-8"
        style={{ backgroundColor: 'var(--bg-global, #f4f1eb)' }}
      >
        <div className="mb-8">
          <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#bc4749' }}>
            {t('event.join.brandName', lang)}
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
            {t('event.register.registerToGet', lang)}
          </p>
          <RegisterForm eventId={event.id} eventTitle={event.title} shareToken={share} />
        </div>
      </div>
    </>
  )
}
