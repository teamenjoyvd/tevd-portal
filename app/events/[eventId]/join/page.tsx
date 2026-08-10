import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { JoinActions } from './components/JoinActions'
import { CancelActions } from './components/CancelActions'
import { ResendLinkForm } from '../components/ResendLinkForm'
import { t } from '@/lib/i18n'
import { notifySharerOfAttendance } from '@/lib/notifications/share-events'
import { getLangFromCookies } from '@/lib/utils/lang-cookie'

type Props = {
  params:       Promise<{ eventId: string }>
  searchParams: Promise<{ token?: string }>
}

// -- Sub-components (module-scoped -- never defined inside render fn) ----------

function InvalidState({ eventId, reason, lang }: { eventId: string; reason: 'missing' | 'invalid' | 'expired' | 'revoked' | 'cancelled'; lang: 'en' | 'bg' }) {
  const message = reason === 'expired'
    ? t('event.join.linkExpired', lang)
    : reason === 'revoked'
    ? t('event.join.linkRevoked', lang)
    : reason === 'cancelled'
    ? t('event.join.linkCancelled', lang)
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
            {reason === 'expired' && <ResendLinkForm eventId={eventId} />}
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
          {reason === 'expired' && <ResendLinkForm eventId={eventId} />}
        </div>
      </div>
    </>
  )
}

// -- Page ----------------------------------------------------------------------

type JoinedEvent = {
  title:       string
  meeting_url: string | null
  start_time:  string
  end_time:    string
} | null

export default async function GuestJoinPage({ params, searchParams }: Props) {
  const { eventId } = await params
  const { token }   = await searchParams

  const lang = await getLangFromCookies()

  const supabase = createServiceClient()

  // Resolved by whichever branch below owns this request: the guest magic
  // link, or the token-free member URL.
  let registrantName: string
  let event: JoinedEvent

  if (token) {
    const { data: reg } = await supabase
      .from('guest_registrations')
      .select('id, name, event_id, expires_at, share_link_id, cancelled_at, calendar_events(title, meeting_url, start_time, end_time)')
      .eq('token', token)
      .single()

    if (!reg)                                  return <InvalidState eventId={eventId} reason="invalid" lang={lang} />
    if (reg.event_id !== eventId)              return <InvalidState eventId={eventId} reason="invalid" lang={lang} />
    if (reg.cancelled_at !== null)             return <InvalidState eventId={eventId} reason="cancelled" lang={lang} />
    // expires_at is NULL for member registrations (2608-DEV-705), which never
    // expire. A member row cannot reach this branch anyway — `reg` is looked up
    // by `.eq('token', …)` and member rows have no token — but "no expiry" must
    // read as "not expired", never as "expired at epoch 0".
    if (reg.expires_at !== null && new Date(reg.expires_at) < new Date()) {
      return <InvalidState eventId={eventId} reason="expired" lang={lang} />
    }

    // Stamp attendance + confirm status — idempotent, only writes when not already set
    const { data: stamped } = await supabase
      .from('guest_registrations')
      .update({ attended_at: new Date().toISOString(), status: 'confirmed' })
      .eq('id', reg.id)
      .is('attended_at', null)
      .select('id')

    // Notify sharer — fire-and-forget, must not block render. Gated on the
    // update having actually stamped a row: this page is a GET, so a refresh,
    // a revisit or a mail-client link prefetch re-renders it, and an ungated
    // call mails the sharer once per view (2608-DEV-704).
    if (reg.share_link_id && stamped && stamped.length > 0) {
      notifySharerOfAttendance(reg.share_link_id, reg.name)
    }

    registrantName = reg.name
    // Narrow joined relation -- PostgREST returns object for to-one FK
    event = reg.calendar_events as unknown as JoinedEvent
  } else {
    // -- Member path (2608-DEV-707) ------------------------------------------
    // The canonical, token-free attendance URL: same screen, same idempotent
    // stamp, same sharer notification as the guest magic link — the member
    // authenticates through Clerk instead of carrying a token. `/events/(.*)`
    // is in PUBLIC_ROUTE_PATTERNS, so clerkMiddleware runs without protecting:
    // `auth()` yields a null userId for an anonymous visitor, who falls through
    // to the same InvalidState the token-less URL always rendered.
    const { userId } = await auth()
    if (!userId) return <InvalidState eventId={eventId} reason="missing" lang={lang} />

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('clerk_id', userId)
      .maybeSingle()

    if (!profile) return <InvalidState eventId={eventId} reason="missing" lang={lang} />

    const { data: reg } = await supabase
      .from('guest_registrations')
      .select('id, name, share_link_id, calendar_events(title, meeting_url, start_time, end_time)')
      .eq('event_id', eventId)
      .eq('profile_id', profile.id)
      .is('cancelled_at', null)
      .maybeSingle()

    // No active member registration — indistinguishable, from here, from any
    // other token-less visit.
    if (!reg) return <InvalidState eventId={eventId} reason="missing" lang={lang} />

    // No expiry check: member rows carry expires_at NULL by construction
    // (2608-DEV-705) — there is nothing to expire.
    const { data: stamped } = await supabase
      .from('guest_registrations')
      .update({ attended_at: new Date().toISOString(), status: 'confirmed' })
      .eq('id', reg.id)
      .is('attended_at', null)
      .select('id')

    if (reg.share_link_id && stamped && stamped.length > 0) {
      notifySharerOfAttendance(reg.share_link_id, reg.name)
    }

    registrantName = reg.name
    event = reg.calendar_events as unknown as JoinedEvent
  }

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
              {t('event.join.hiClick', lang).replace('{name}', registrantName)}
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
            {/* Guest self-service cancel is token-driven. A member cancels from
                the calendar popup instead, so this is omitted on that branch. */}
            {token && <CancelActions token={token} />}
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
            {t('event.join.hiTap', lang).replace('{name}', registrantName)}
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
          {token && <CancelActions token={token} />}
        </div>
      </div>
    </>
  )
}
