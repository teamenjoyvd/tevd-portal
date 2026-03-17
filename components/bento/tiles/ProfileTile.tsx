'use client'

import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { useQuery } from '@tanstack/react-query'
import BentoCard from '@/components/bento/BentoCard'
import { Eyebrow } from '@/components/bento/BentoCard'

type VerifRequest = { status: 'pending' | 'approved' | 'denied' } | null
type Profile = { role: string; first_name: string; abo_number: string | null }
type Upline = { upline_name: string | null }

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', core: 'Core', member: 'Member', guest: 'Guest',
}

const ROLE_STYLES: Record<string, { bg: string; color: string }> = {
  admin:  { bg: 'var(--brand-forest)',  color: 'var(--brand-parchment)' },
  core:   { bg: 'var(--brand-teal)',    color: 'var(--brand-parchment)' },
  member: { bg: 'rgba(62,119,133,0.15)', color: 'var(--brand-teal)'    },
  guest:  { bg: 'rgba(0,0,0,0.06)',     color: 'var(--text-secondary)'  },
}

export default function ProfileTile({ colSpan = 3 }: { colSpan?: number }) {
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

  const isUnverified = profile?.role === 'guest' &&
    !!verRequest && verRequest !== null &&
    (verRequest.status === 'pending' || verRequest.status === 'denied')

  const role = profile?.role ?? 'guest'
  const roleStyle = ROLE_STYLES[role] ?? ROLE_STYLES.guest
  const isAdminOrCore = role === 'admin' || role === 'core'

  const firstName = user?.firstName
    ?? profile?.first_name
    ?? null

  // Loading state
  if (!isLoaded) {
    return (
      <BentoCard variant="default" colSpan={colSpan} className="flex flex-col justify-between">
        <div className="h-6 w-24 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--border-default)' }} />
        <div className="h-4 w-16 rounded-lg animate-pulse mt-3" style={{ backgroundColor: 'var(--border-default)' }} />
      </BentoCard>
    )
  }

  // Unauthenticated guest
  if (!isSignedIn) {
    return (
      <BentoCard variant="default" colSpan={colSpan} className="flex flex-col justify-between">
        <div>
          <Eyebrow>Profile</Eyebrow>
          <h2 className="font-display text-2xl font-semibold mt-3"
            style={{ color: 'var(--text-primary)' }}>
            Hey, Guest.
          </h2>
          <p className="text-sm mt-2 font-body" style={{ color: 'var(--text-secondary)' }}>
            Sign in to access your profile and personalised content.
          </p>
        </div>
        <Link
          href="/sign-in"
          className="mt-4 inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ backgroundColor: 'var(--brand-crimson)', color: 'var(--brand-parchment)' }}
        >
          Sign in →
        </Link>
      </BentoCard>
    )
  }

  // Unverified Member
  if (isUnverified) {
    return (
      <BentoCard variant="default" colSpan={colSpan} className="flex flex-col justify-between">
        <div>
          <Eyebrow>Profile</Eyebrow>
          <h2 className="font-display text-2xl font-semibold mt-3"
            style={{ color: 'var(--text-primary)' }}>
            Hey, {firstName ?? 'there'}.
          </h2>
          <span className="inline-block mt-2 text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: 'rgba(138,133,119,0.15)', color: 'var(--text-secondary)' }}>
            Unverified Member
          </span>
          <p className="text-xs mt-2 font-body" style={{ color: 'var(--text-secondary)' }}>
            {verRequest?.status === 'pending'
              ? 'Verification pending admin review.'
              : 'Verification was denied. Update your details and resubmit.'}
          </p>
        </div>
        <Link
          href="/profile"
          className="mt-4 text-xs font-semibold tracking-widest uppercase transition-opacity hover:opacity-70"
          style={{ color: 'var(--brand-crimson)' }}
        >
          View profile →
        </Link>
      </BentoCard>
    )
  }

  // Authenticated member+
  return (
    <BentoCard variant="default" colSpan={colSpan} className="flex flex-col justify-between">
      <div>
        <Eyebrow>Profile</Eyebrow>
        <h2 className="font-display text-2xl font-semibold mt-3"
          style={{ color: 'var(--text-primary)' }}>
          Hey, {firstName ?? 'there'}.
        </h2>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: roleStyle.bg, color: roleStyle.color }}>
            {ROLE_LABELS[role] ?? role}
          </span>
          {uplineData?.upline_name && (
            <span className="text-xs font-body" style={{ color: 'var(--text-secondary)' }}>
              ↑ {uplineData.upline_name}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 mt-4">
        <Link
          href="/profile"
          className="text-xs font-semibold tracking-widest uppercase transition-opacity hover:opacity-70"
          style={{ color: 'var(--brand-crimson)' }}
        >
          Profile →
        </Link>
        {isAdminOrCore && (
          <Link
            href="/admin"
            className="text-xs font-semibold tracking-widest uppercase transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-secondary)' }}
          >
            Admin →
          </Link>
        )}
      </div>
    </BentoCard>
  )
}
