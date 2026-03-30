'use client'

import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { useQuery } from '@tanstack/react-query'
import BentoCard from '@/components/bento/BentoCard'
import { useLanguage } from '@/lib/hooks/useLanguage'
import type { TranslationKey } from '@/lib/i18n/translations'

type VerifRequest = { status: 'pending' | 'approved' | 'denied' } | null
type Profile = { role: string; first_name: string; abo_number: string | null }
type Upline = { upline_name: string | null }

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
    queryFn: () => fetch('/api/profile').then(r => r.json()),
    enabled: !!isSignedIn,
    staleTime: 5 * 60 * 1000,
  })

  const { data: uplineData } = useQuery<Upline>({
    queryKey: ['profile-upline'],
    queryFn: () => fetch('/api/profile/upline').then(r => r.json()),
    enabled: !!isSignedIn && !!profile?.abo_number,
    staleTime: 5 * 60 * 1000,
  })

  const { data: verRequest } = useQuery<VerifRequest>({
    queryKey: ['verify-abo'],
    queryFn: () => fetch('/api/profile/verify-abo').then(r => r.json()),
    enabled: !!isSignedIn && profile?.role === 'guest',
    staleTime: 5 * 60 * 1000,
  })

  const { t } = useLanguage()

  const isUnverified = profile?.role === 'guest' &&
    !!verRequest && verRequest !== null &&
    (verRequest.status === 'pending' || verRequest.status === 'denied')

  const role = profile?.role ?? 'guest'
  const roleStyle = ROLE_STYLES[role] ?? ROLE_STYLES.guest
  const isAdmin = role === 'admin'

  const firstName = user?.firstName
    ?? profile?.first_name
    ?? null

  // Loading state
  if (!isLoaded) {
    return (
      <BentoCard variant="teal" colSpan={colSpan} mobileColSpan={mobileColSpan} rowSpan={rowSpan} style={style} className="flex flex-col justify-between">
        <div className="h-6 w-24 rounded-lg animate-pulse" style={{ backgroundColor: 'rgba(250,248,243,0.15)' }} />
        <div className="h-4 w-16 rounded-lg animate-pulse mt-3" style={{ backgroundColor: 'rgba(250,248,243,0.15)' }} />
      </BentoCard>
    )
  }

  // Unauthenticated guest
  if (!isSignedIn) {
    return (
      <BentoCard variant="teal" colSpan={colSpan} mobileColSpan={mobileColSpan} rowSpan={rowSpan} style={style} className="flex flex-col justify-between">
        <div className="flex items-center justify-end">
          <Link
            href="/sign-in"
            className="font-body text-[11px] font-bold tracking-widest uppercase transition-opacity hover:opacity-70"
            style={{ color: 'var(--brand-parchment)' }}
          >
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

  // Unverified Member
  if (isUnverified) {
    return (
      <BentoCard variant="teal" colSpan={colSpan} mobileColSpan={mobileColSpan} rowSpan={rowSpan} style={style} className="flex flex-col justify-between">
        <div className="flex items-center justify-end">
          <Link
            href="/profile"
            className="font-body text-[11px] font-bold tracking-widest uppercase transition-opacity hover:opacity-70"
            style={{ color: 'var(--brand-parchment)' }}
          >
            {t('profile.profileLink')}
          </Link>
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold mt-3" style={{ color: 'var(--brand-parchment)' }}>
            Hey, {firstName ?? 'there'}.
          </h2>
          <span className="inline-block mt-2 text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: 'rgba(250,248,243,0.15)', color: 'var(--brand-parchment)' }}>
            {t('profile.unverified')}
          </span>
          <p className="text-xs mt-2 font-body" style={{ color: 'rgba(250,248,243,0.70)' }}>
            {verRequest?.status === 'pending'
              ? t('profile.verifPendingDesc')
              : t('profile.verifDeniedDesc')}
          </p>
        </div>
      </BentoCard>
    )
  }

  // Authenticated member+
  return (
    <BentoCard variant="teal" colSpan={colSpan} mobileColSpan={mobileColSpan} rowSpan={rowSpan} style={style} className="flex flex-col justify-between">
      <div className="flex items-center justify-end gap-3">
        <Link
          href="/profile"
          className="font-body text-[11px] font-bold tracking-widest uppercase transition-opacity hover:opacity-70"
          style={{ color: 'var(--brand-parchment)' }}
        >
          {t('profile.profileLink')}
        </Link>
        {isAdmin && (
          <Link
            href="/admin"
            className="font-body text-[11px] font-bold tracking-widest uppercase transition-opacity hover:opacity-70"
            style={{ color: 'rgba(250,248,243,0.65)' }}
          >
            {t('profile.adminLink')}
          </Link>
        )}
      </div>
      <div>
        <h2 className="font-display text-2xl font-semibold mt-3" style={{ color: 'var(--brand-parchment)' }}>
          Hey, {firstName ?? 'there'}.
        </h2>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: roleStyle.bg, color: roleStyle.color }}>
            {t(('role.' + role) as TranslationKey)}
          </span>
          {uplineData?.upline_name && (
            <span className="text-xs font-body" style={{ color: 'rgba(250,248,243,0.70)' }}>
              ↑ {uplineData.upline_name}
            </span>
          )}
        </div>
      </div>
    </BentoCard>
  )
}
