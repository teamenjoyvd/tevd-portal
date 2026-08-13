'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { UserPlus } from 'lucide-react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { apiClient } from '@/lib/apiClient'
import { computeFunnel, type GuestRow } from '@/lib/invites'
import { BentoHeader } from './BentoHeader'

// ── Types ─────────────────────────────────────────────────────────────────────

type ShareLink = {
  id:         string
  revoked_at: string | null
  guests:     GuestRow[]
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
      const funnel = computeFunnel(link.guests, link.revoked_at !== null)
      acc.totalGuests += funnel.registrations
      acc.confirmed   += funnel.confirmed
      acc.attended    += funnel.attended
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
    <div className="flex flex-col gap-4 h-full">
      <BentoHeader icon={UserPlus} title={t('profile.bento.invites')} />

      {/* Stat chips */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-2">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-14 rounded-container animate-pulse"
              style={{ backgroundColor: 'var(--skeleton-base)' }}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {stats.map(({ label, value }) => (
            <div
              key={label}
              className="rounded-xl px-3 py-2 flex flex-col gap-0.5"
              style={{ backgroundColor: 'var(--bg-card-raised)' }}
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
        style={{ backgroundColor: 'var(--border-default)', color: 'var(--text-primary)' }}
      >
        {t('profile.invites.viewAll')} →
      </Link>
    </div>
  )
}
