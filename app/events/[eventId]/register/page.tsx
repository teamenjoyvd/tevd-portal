import { notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { countAttendeesForCapacity } from '@/lib/server/event-capacity'
import { RegisterForm } from './components/RegisterForm'
import { MemberAttendPanel } from './components/MemberAttendPanel'
import { ResendLinkForm } from '../components/ResendLinkForm'
import { t } from '@/lib/i18n'
import { getLangFromCookies } from '@/lib/utils/lang-cookie'

type Props = {
  params:       Promise<{ eventId: string }>
  searchParams: Promise<{ share?: string }>
}

type SharerProfile = { first_name: string | null; last_name: string | null } | null

type MemberIdentity = { id: string; first_name: string | null; last_name: string | null }

export default async function GuestRegisterPage({ params, searchParams }: Props) {
  const { eventId }  = await params
  const { share }    = await searchParams
  const supabase     = createServiceClient()

  const lang = await getLangFromCookies()

  const { data: event } = await supabase
    .from('calendar_events')
    .select('id, title, start_time, end_time, allow_guest_registration, guest_capacity')
    .eq('id', eventId)
    .single()

  if (!event || !event.allow_guest_registration) notFound()

  const eventEnded = new Date(event.end_time) < new Date()

  // Shares countAttendeesForCapacity with registerGuest and attendEvent so the
  // page and the actions can never disagree about whether the event is full —
  // approved role holders are excluded from both (2608-DEV-710 D10).
  let eventFull = false
  if (event.guest_capacity != null) {
    const attendees = await countAttendeesForCapacity(supabase, eventId)
    eventFull = attendees >= event.guest_capacity
  }

  // `event_share_links` has exactly ONE FK to `profiles`
  // (20260504000001_event_share_links.sql:7), so this embed needs no PostgREST
  // hint — the multi-FK `payments` trap in docs/ai/GOTCHAS.md does not apply.
  let shareLinkRevoked = false
  let sharerName: string | null = null
  if (share !== undefined && share !== '') {
    const { data: shareLink } = await supabase
      .from('event_share_links')
      .select('revoked_at, profile:profiles(first_name, last_name)')
      .eq('token', share)
      .eq('event_id', eventId)
      .single()
    shareLinkRevoked = !!shareLink?.revoked_at

    // Attribution is only shown for a live link — a revoked one credits nobody.
    if (shareLink && !shareLink.revoked_at) {
      // Narrow joined relation -- PostgREST returns object for to-one FK
      const sharer = shareLink.profile as unknown as SharerProfile
      // Convention: first_name + ' ' + last_name (lib/notifications/share-events.ts:60).
      const name = `${sharer?.first_name ?? ''} ${sharer?.last_name ?? ''}`.trim()
      sharerName = name === '' ? null : name
    }
  }

  // -- Member path (2608-DEV-708) ---------------------------------------------
  // `/events/(.*)` is in PUBLIC_ROUTE_PATTERNS (lib/public-routes.ts:29), but
  // clerkMiddleware still resolves a session on a public route — the join
  // page's member branch relies on exactly this (join/page.tsx:165-174).
  // Anonymous visitors get a null userId and fall through to the guest form.
  const { userId } = await auth()

  let member: MemberIdentity | null = null
  if (userId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, first_name, last_name')
      .eq('clerk_id', userId)
      .maybeSingle()

    // role 'guest' has no portal identity worth using here, and the attend
    // route would 403 them anyway (api/events/[id]/attend/route.ts:38) — they
    // fall through to the unchanged guest form.
    if (profile && profile.role !== 'guest') {
      member = { id: profile.id, first_name: profile.first_name, last_name: profile.last_name }
    }
  }

  let isAttending = false
  let meetingUrl: string | null = null
  if (member) {
    const { data: registration } = await supabase
      .from('guest_registrations')
      .select('id')
      .eq('event_id', eventId)
      .eq('profile_id', member.id)
      .is('cancelled_at', null)
      .maybeSingle()
    isAttending = registration != null

    // D3: meeting_url is fetched ONLY behind an active registration, so it is
    // never in this page's payload for someone who has not attended. That is
    // also why the panel re-renders from the server after a successful attend
    // instead of flipping client state.
    if (isAttending) {
      const { data: gated } = await supabase
        .from('calendar_events')
        .select('meeting_url')
        .eq('id', eventId)
        .single()
      meetingUrl = gated?.meeting_url ?? null
    }
  }

  const memberName = member === null
    ? ''
    : `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim()

  const dateLabel = new Date(event.start_time).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  // A member re-opening their own link is not consuming a new seat, so a full
  // event must not block them once they already hold an active row. Ended and
  // revoked-link still block everyone: a revoked link attributes nothing.
  const blockedMessage = eventEnded
    ? t('event.register.eventEnded', lang)
    : shareLinkRevoked
    ? t('event.register.linkNoLongerActive', lang)
    : eventFull && !isAttending
    ? t('event.register.full', lang)
    : null

  // Built once and rendered in BOTH layout blocks below: the desktop and mobile
  // trees are separate DOM, so a second inline copy of these props would have to
  // be kept in step by hand, and only the 390px e2e case would catch the drift.
  const memberPanel = member === null ? null : (
    <MemberAttendPanel
      eventId={event.id}
      meetingUrl={meetingUrl}
      eventTitle={event.title}
      startTime={event.start_time}
      endTime={event.end_time}
      memberName={memberName}
      sharerName={sharerName}
      shareToken={share}
      isAttending={isAttending}
    />
  )

  return (
    <>
      {/* ── Desktop ────────────────────────────────────────────────────────── */}
      <div
        className="hidden md:flex min-h-screen items-center justify-center px-6"
        style={{ backgroundColor: 'var(--bg-global)' }}
      >
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: 'var(--status-alert-fg)' }}>
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
            ) : memberPanel !== null ? (
              memberPanel
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
        style={{ backgroundColor: 'var(--bg-global)' }}
      >
        <div className="mb-8">
          <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: 'var(--status-alert-fg)' }}>
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
            <>
              <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>{blockedMessage}</p>
              <ResendLinkForm eventId={event.id} />
            </>
          ) : memberPanel !== null ? (
            memberPanel
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
