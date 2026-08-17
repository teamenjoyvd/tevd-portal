'use client'

import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { useQuery } from '@tanstack/react-query'
import BentoCard from '@/components/bento/BentoCard'
import { useLanguage } from '@/lib/hooks/useLanguage'
import type { TranslationKey } from '@/lib/i18n/translations'
import { apiClient } from '@/lib/apiClient'

type VerifRequest = { status: 'pending' | 'approved' | 'denied' } | null
type SpouseLinkReq = { status: 'pending' | 'approved' | 'denied' } | null
type Upline = { upline_name: string | null; upline_abo_number: string | null } | null
type Profile = {
  role: string
  first_name: string | null
  last_name: string | null
  display_names: Record<string, string> | null
  abo_number: string | null
  primary_profile_id: string | null
  upline: Upline
  verRequest: VerifRequest
  ownSpouseLinkRequest: SpouseLinkReq
  pendingSpouseLinkCount: number
}

const ROLE_STYLES: Record<string, { bg: string; color: string }> = {
  admin:  { bg: 'rgba(250,248,243,0.20)', color: 'var(--brand-parchment)' },
  core:   { bg: 'rgba(250,248,243,0.20)', color: 'var(--brand-parchment)' },
  member: { bg: 'rgba(250,248,243,0.20)', color: 'var(--brand-parchment)' },
  guest:  { bg: 'rgba(250,248,243,0.12)', color: 'rgba(250,248,243,0.70)' },
}

export default function ProfileTile({
  colSpan = 3,
  mobileColSpan = 12,
  rowSpan,
  style,
}: {
  colSpan?: number
  mobileColSpan?: number
  rowSpan?: number
  style?: React.CSSProperties
}) {
  const { isLoaded, isSignedIn, user } = useUser()

  const { data: profile } = useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: () => apiClient('/api/profile'),
    enabled: !!isSignedIn,
    staleTime: 5 * 60 * 1000,
  })

  const { lang, t } = useLanguage()

  const verRequest = profile?.verRequest ?? null
  const uplineData = profile?.upline ?? null

  // A guest who never submitted a verification request has verRequest === null.
  // The old predicate required verRequest !== null, so that population — the one
  // most in need of the nudge — fell through to the "Authenticated member+"
  // branch below and got a plain greeting with no badge (2608-DEV-742).
  // Every guest who is not already linked to a primary is unverified; the one
  // exception is a guest waiting on their primary to approve a spouse link,
  // who is handled separately because they are blocked, not idle.
  const isGuest = profile?.role === 'guest'
  const isLinkedSecondary = (profile?.primary_profile_id ?? null) !== null
  const awaitingPrimary =
    isGuest && !isLinkedSecondary && profile?.ownSpouseLinkRequest?.status === 'pending'
  // 'approved' with the role not yet promoted is a transient admin state — they
  // are not stuck and telling them to verify would be wrong, so they keep the
  // plain greeting they get today. Matches selectVariant() in VerifyNudgeDialog.
  const isUnverified =
    isGuest && !isLinkedSecondary && !awaitingPrimary && verRequest?.status !== 'approved'

  // State 5 — a primary member with inbound spouse-link requests to approve.
  // Mirrors SpouseLinkBanner on /profile (AboInfoContent.tsx:38-62).
  const pendingSpouseLinkCount = profile?.pendingSpouseLinkCount ?? 0

  const role = profile?.role ?? 'guest'
  const roleStyle = ROLE_STYLES[role] ?? ROLE_STYLES.guest
  const isAdmin = role === 'admin'

  // Localised display name derivation.
  // EN path: Clerk firstName preferred (freshest), then DB last name fallbacks.
  // BG path: display_names.bg_first / bg_last preferred, then EN fallbacks.
  // Guard empty strings from DB with || null (not ??) — DB defaults to '' not null.
  const enFirst = user?.firstName || profile?.first_name || null
  const enLast  = user?.lastName  || profile?.last_name  || null
  const bgFirst = profile?.display_names?.['bg_first'] || null
  const bgLast  = profile?.display_names?.['bg_last']  || null

  const displayName: string | null = lang === 'bg'
    ? (bgFirst ?? bgLast ?? enFirst ?? enLast)
    : (enFirst ?? enLast ?? bgFirst ?? bgLast)

  // Loading state
  if (!isLoaded) {
    return (
      <BentoCard variant="teal" colSpan={colSpan} mobileColSpan={mobileColSpan} rowSpan={rowSpan} style={style} className="flex flex-col justify-between">
        <div className="flex items-center justify-end">
          <div className="h-3 w-16 rounded animate-pulse" style={{ backgroundColor: 'rgba(250,248,243,0.15)' }} />
        </div>
        <div className="h-6 w-24 rounded-container animate-pulse" style={{ backgroundColor: 'rgba(250,248,243,0.15)' }} />
      </BentoCard>
    )
  }

  // Unauthenticated guest
  if (!isSignedIn) {
    return (
      <BentoCard variant="teal" colSpan={colSpan} mobileColSpan={mobileColSpan} rowSpan={rowSpan} style={style} className="flex flex-col justify-between">
        <div className="flex items-center justify-end">
          <Link href="/sign-in" className="font-body text-[11px] font-bold tracking-widest uppercase pill-link-parchment">
            {t('profile.signIn')}
          </Link>
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold mt-3" style={{ color: 'var(--brand-parchment)' }}>
            {t('profile.heyGuest')}
          </h2>
          <p className="text-sm mt-2 font-body" style={{ color: 'rgba(250,248,243,0.70)' }}>
            {t('profile.signInDesc')}
          </p>
        </div>
      </BentoCard>
    )
  }

  // Guest states — same card, different badge and one line of copy. State 4
  // (awaiting the primary's approval) is deliberately NOT told to verify an ABO:
  // verify-abo/route.ts:27-35 forbids secondaries from submitting one at all.
  if (awaitingPrimary || isUnverified) {
    const badgeKey: TranslationKey = awaitingPrimary ? 'profile.awaitingPrimary' : 'profile.unverified'
    const descKey: TranslationKey = awaitingPrimary
      ? 'profile.awaitingPrimaryDesc'
      : verRequest?.status === 'pending' ? 'profile.verifPendingDesc'
      : verRequest?.status === 'denied'  ? 'profile.verifDeniedDesc'
      : 'profile.verifNotStartedDesc'

    return (
      <BentoCard variant="teal" colSpan={colSpan} mobileColSpan={mobileColSpan} rowSpan={rowSpan} style={style} className="flex flex-col justify-between">
        <div className="flex items-center justify-end">
          <Link href="/profile" className="font-body text-[11px] font-bold tracking-widest uppercase pill-link-parchment">
            {t('profile.profileLink')}
          </Link>
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold mt-3" style={{ color: 'var(--brand-parchment)' }}>
            Hey, {displayName ?? t('home.profile.there')}.
          </h2>
          <span className="inline-block mt-2 text-xs font-semibold px-2.5 py-1 rounded-control"
            style={{ backgroundColor: 'rgba(250,248,243,0.15)', color: 'var(--brand-parchment)' }}>
            {t(badgeKey)}
          </span>
          <p className="text-xs mt-2 font-body" style={{ color: 'rgba(250,248,243,0.70)' }}>
            {t(descKey)}
          </p>
        </div>
      </BentoCard>
    )
  }

  // Authenticated member+
  return (
    <BentoCard variant="teal" colSpan={colSpan} mobileColSpan={mobileColSpan} rowSpan={rowSpan} style={style} className="flex flex-col justify-between">
      <div className="flex items-center justify-end gap-3">
        <Link href="/profile" className="font-body text-[11px] font-bold tracking-widest uppercase pill-link-parchment">
          {t('profile.profileLink')}
        </Link>
        {isAdmin && (
          <Link href="/admin" className="font-body text-[11px] font-bold tracking-widest uppercase pill-link-parchment" style={{ opacity: 0.65 }}>
            {t('profile.adminLink')}
          </Link>
        )}
      </div>
      <div>
        <h2 className="font-display text-2xl font-semibold mt-3" style={{ color: 'var(--brand-parchment)' }}>
          Hey, {displayName ?? t('home.profile.there')}.
        </h2>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-control"
            style={{ backgroundColor: roleStyle.bg, color: roleStyle.color }}>
            {t(('role.' + role) as TranslationKey)}
          </span>
          {uplineData?.upline_name && (
            <span className="text-xs font-body" style={{ color: 'rgba(250,248,243,0.70)' }}>
              ↑ {uplineData.upline_name}
            </span>
          )}
        </div>
        {/* State 5 — inbound spouse-link requests to approve. The applicant cannot
            act here, only the primary can, so the prompt lives on THIS tile.
            Count-based copy matches SpouseLinkBanner: /api/profile returns a count,
            not the requester's name. */}
        {pendingSpouseLinkCount > 0 && (
          <Link
            href="/profile/spouse-link"
            className="flex items-center gap-2 mt-3 px-3 py-2 rounded-control"
            style={{ backgroundColor: 'rgba(250,248,243,0.15)', textDecoration: 'none' }}
          >
            <span className="text-xs font-medium" style={{ color: 'var(--brand-parchment)' }}>
              {pendingSpouseLinkCount === 1
                ? t('profile.spouseLinkBanner.single')
                : t('profile.spouseLinkBanner.multiple').replace('{{count}}', String(pendingSpouseLinkCount))}
            </span>
            <span className="ml-auto shrink-0 text-[11px] font-semibold" style={{ color: 'var(--brand-parchment)' }}>
              {t('profile.spouseLinkBanner.review')}
            </span>
          </Link>
        )}
      </div>
    </BentoCard>
  )
}
