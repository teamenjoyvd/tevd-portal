'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { apiClient } from '@/lib/apiClient'

// ── Types ─────────────────────────────────────────────────────────────────────

type GuestRow = {
  id:          string
  attended_at: string | null
  status:      string
}

type ShareLink = {
  id:     string
  guests: GuestRow[]
}

type ApiResponse = { links: ShareLink[]; total: number }

// ── Component ─────────────────────────────────────────────────────────────────

export function InvitesBento() {
  const { t } = useLanguage()

  const { data, isLoading } = useQuery<ApiResponse>({
    queryKey: ['invites'],
    queryFn:  () => apiClient('/api/profile/event-shares'),
  })

  const totalLinks = data?.links?.length ?? 0
  const { totalGuests, confirmed, attended } = (data?.links ?? []).reduce(
    (acc, link) => {
      acc.totalGuests += link.guests.length
      link.guests.forEach((g) => {
        const isAttended = !!g.attended_at
        if (isAttended) acc.attended++
        if (isAttended || g.status === 'confirmed') acc.confirmed++
      })
      return acc
    },
    { totalGuests: 0, confirmed: 0, attended: 0 },
  )

  const stats: { label: string; value: number }[] = [
    { label: t('profile.invites.statLinks'),     value: totalLinks  },
    { label: t('profile.invites.registrations'), value: totalGuests },
    { label: t('profile.invites.confirmed'),     value: confirmed   },
    { label: t('profile.invites.attended'),      value: attended    },
  ]

  return (
    <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      <div className="flex flex-col gap-4 h-full">
        {/* Header */}
        <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>
          {t('profile.bento.invites')}
        </p>

        {/* Stat chips */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-14 rounded-xl animate-pulse"
                style={{ backgroundColor: 'rgba(0,0,0,0.06)' }}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {stats.map(({ label, value }) => (
              <div
                key={label}
                className="rounded-xl px-3 py-2 flex flex-col gap-0.5"
                style={{ backgroundColor: 'rgba(0,0,0,0.04)' }}
              >
                <span className="text-xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                  {value}
                </span>
                <span className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <Link
          href="/profile/invites"
          className="mt-auto text-xs font-semibold px-3 py-2 rounded-xl transition-opacity hover:opacity-70 text-left block"
          style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--text-primary)' }}
        >
          {t('profile.invites.viewAll')} →
        </Link>
      </div>
    </div>
  )
}
