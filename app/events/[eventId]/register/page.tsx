import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/service'
import { RegisterForm } from './components/RegisterForm'
import { ResendLinkForm } from '../components/ResendLinkForm'
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
    .select('id, title, start_time, end_time, allow_guest_registration')
    .eq('id', eventId)
    .single()

  if (!event || !event.allow_guest_registration) notFound()

  const eventEnded = new Date(event.end_time) < new Date()

  let shareLinkRevoked = false
  if (share) {
    const { data: shareLink } = await supabase
      .from('event_share_links')
      .select('revoked_at')
      .eq('token', share)
      .eq('event_id', eventId)
      .single()
    shareLinkRevoked = !!shareLink?.revoked_at
  }

  const dateLabel = new Date(event.start_time).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const blockedMessage = eventEnded
    ? t('event.register.eventEnded', lang)
    : shareLinkRevoked
    ? t('event.register.linkNoLongerActive', lang)
    : null

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
            {blockedMessage ? (
              <>
                <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>{blockedMessage}</p>
                <ResendLinkForm eventId={event.id} />
              </>
            ) : (
              <>
                <p className="text-sm font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>
                  {t('event.register.registerToGet', lang)}
                </p>
                <RegisterForm eventId={event.id} eventTitle={event.title} shareToken={share} />
              </>
            )}
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
          {blockedMessage ? (
            <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>{blockedMessage}</p>
          ) : (
            <>
              <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                {t('event.register.registerToGet', lang)}
              </p>
              <RegisterForm eventId={event.id} eventTitle={event.title} shareToken={share} />
            </>
          )}
        </div>
      </div>
    </>
  )
}
