import Link from 'next/link'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/service'
import { JoinActions } from './components/JoinActions'
import { t } from '@/lib/i18n'

type Props = {
  params:       Promise<{ eventId: string }>
  searchParams: Promise<{ token?: string }>
}

// -- Sub-components (module-scoped -- never defined inside render fn) ----------

function InvalidState({ eventId, reason, lang }: { eventId: string; reason: 'missing' | 'invalid' | 'expired'; lang: 'en' | 'bg' }) {
  const message = reason === 'expired'
    ? t('event.join.linkExpired', lang)
    : t('event.join.linkInvalid', lang)

  return (
    <>
      {/* Desktop */}
      <div
        className="hidden md:flex min-h-screen items-center justify-center px-6"
        style={{ backgroundColor: 'var(--bg-global, #f4f1eb)' }}
      >
        <div className="w-full max-w-sm text-center">
          <p className="text-xs font-bold tracking-widest uppercase mb-6" style={{ color: '#bc4749' }}>
            {t('event.join.brandName', lang)}
          </p>
          <div
            className="rounded-2xl border px-8 py-10"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
          >
            <p className="font-semibold text-base mb-2" style={{ color: 'var(--text-primary)' }}>{message}</p>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              {t('event.join.registerAgainDesc', lang)}
            </p>
            <Link
              href={`/events/${eventId}/register`}
              className="inline-block w-full rounded-xl py-3.5 text-sm font-semibold text-white text-center hover:opacity-80 transition-opacity"
              style={{ backgroundColor: '#1a3c2e' }}
            >
              {t('event.join.registerAgain', lang)}
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile */}
      <div
        className="md:hidden min-h-screen px-5 pt-12 pb-8"
        style={{ backgroundColor: 'var(--bg-global, #f4f1eb)' }}
      >
        <p className="text-xs font-bold tracking-widest uppercase mb-8" style={{ color: '#bc4749' }}>
          {t('event.join.brandName', lang)}
        </p>
        <div
          className="rounded-2xl border px-5 py-8 text-center"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
        >
          <p className="font-semibold text-base mb-2" style={{ color: 'var(--text-primary)' }}>{message}</p>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            {t('event.join.registerAgainDesc', lang)}
          </p>
          <Link
            href={`/events/${eventId}/register`}
            className="block w-full rounded-xl py-3.5 text-sm font-semibold text-white text-center active:opacity-70"
            style={{ backgroundColor: '#1a3c2e', minHeight: 44 }}
          >
            {t('event.join.registerAgain', lang)}
          </Link>
        </div>
      </div>
    </>
  )
}

// -- Page ----------------------------------------------------------------------

export default async function GuestJoinPage({ params, searchParams }: Props) {
  const { eventId } = await params
  const { token }   = await searchParams

  const cookieStore = await cookies()
  const lang = cookieStore.get('tevd_lang')?.value === 'bg' ? 'bg' : 'en'

  if (!token) return <InvalidState eventId={eventId} reason="missing" lang={lang} />

  const supabase = createServiceClient()

  const { data: reg } = await supabase
    .from('guest_registrations')
    .select('id, name, event_id, expires_at, calendar_events(title, meeting_url, start_time, end_time)')
    .eq('token', token)
    .single()

  if (!reg)                                  return <InvalidState eventId={eventId} reason="invalid" lang={lang} />
  if (reg.event_id !== eventId)              return <InvalidState eventId={eventId} reason="invalid" lang={lang} />
  if (new Date(reg.expires_at) < new Date()) return <InvalidState eventId={eventId} reason="expired" lang={lang} />

  // Narrow joined relation -- PostgREST returns object for to-one FK
  const event = reg.calendar_events as unknown as {
    title:       string
    meeting_url: string | null
    start_time:  string
    end_time:    string
  } | null

  const actionProps = {
    eventId,
    eventTitle: event?.title      ?? '',
    meetingUrl: event?.meeting_url ?? null,
    startTime:  event?.start_time  ?? '',
    endTime:    event?.end_time    ?? '',
  }

  return (
    <>
      {/* -- Desktop ----------------------------------------------------------- */}
      <div
        className="hidden md:flex min-h-screen items-center justify-center px-6"
        style={{ backgroundColor: 'var(--bg-global, #f4f1eb)' }}
      >
        <div className="w-full max-w-sm">
          <p className="text-xs font-bold tracking-widest uppercase mb-6 text-center" style={{ color: '#bc4749' }}>
            {t('event.join.brandName', lang)}
          </p>
          <div
            className="rounded-2xl border px-8 py-10"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
          >
            <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>{t('event.join.youreJoining', lang)}</p>
            <h1 className="font-display text-xl font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>
              {event?.title}
            </h1>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              {t('event.join.hiClick', lang).replace('{name}', reg.name)}
            </p>
            {event?.meeting_url ? (
              <a
                href={event.meeting_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-full rounded-xl py-3.5 text-sm font-semibold text-white hover:opacity-80 transition-opacity"
                style={{ backgroundColor: '#1a3c2e', minHeight: 44 }}
              >
                {t('event.join.joinMeeting', lang)}
              </a>
            ) : (
              <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
                {t('event.join.noMeetingLink', lang)}
              </p>
            )}
            <JoinActions {...actionProps} />
          </div>
        </div>
      </div>

      {/* -- Mobile ------------------------------------------------------------ */}
      <div
        className="md:hidden min-h-screen px-5 pt-12 pb-8"
        style={{ backgroundColor: 'var(--bg-global, #f4f1eb)' }}
      >
        <p className="text-xs font-bold tracking-widest uppercase mb-8" style={{ color: '#bc4749' }}>
          {t('event.join.brandName', lang)}
        </p>
        <div
          className="rounded-2xl border px-5 py-8"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
        >
          <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>{t('event.join.youreJoining', lang)}</p>
          <h1 className="font-display text-xl font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>
            {event?.title}
          </h1>
          <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
            {t('event.join.hiTap', lang).replace('{name}', reg.name)}
          </p>
          {event?.meeting_url ? (
            <a
              href={event.meeting_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-full rounded-xl py-3.5 text-sm font-semibold text-white active:opacity-70"
              style={{ backgroundColor: '#1a3c2e', minHeight: 44 }}
            >
              {t('event.join.joinMeeting', lang)}
            </a>
          ) : (
            <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
              {t('event.join.noMeetingLink', lang)}
            </p>
          )}
          <JoinActions {...actionProps} />
        </div>
      </div>
    </>
  )
}
