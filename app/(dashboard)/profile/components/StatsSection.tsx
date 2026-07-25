'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { type LosSummaryData } from '../types'
import { apiClient } from '@/lib/apiClient'

export const STATS_MIN_HEIGHT = 160

export function StatsSection({ role, aboNumber }: { role: string; aboNumber: string | null }) {
  const { t } = useLanguage()
  const isCore = role === 'core'

  const { data: losSummary, isLoading } = useQuery<LosSummaryData>({
    queryKey: ['profile-los-summary'],
    queryFn: () => apiClient('/api/profile/los-summary'),
    enabled: !!aboNumber,
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return <div className="rounded-2xl animate-pulse h-full" style={{ backgroundColor: 'var(--border-default)' }} />
  }

  // Merged LOS bento: show when there are stats to display OR the user (core) can upload.
  if (!losSummary && !isCore) return null

  return (
    <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-4 pr-24" style={{ color: 'var(--brand-crimson)' }}>{t('profile.stats')}</p>
      {losSummary && (
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('profile.role')}</p>
            <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{t(`profile.role.label.${role}` as Parameters<typeof t>[0])}</p>
          </div>
          {losSummary.depth !== null && losSummary.depth !== undefined && (
            <div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('profile.statsDepth')}</p>
              <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{t('profile.statsLevel')} {losSummary.depth}</p>
            </div>
          )}
          <div>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('profile.statsDirectDownlines')}</p>
            <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{losSummary.direct_downline_count}</p>
          </div>
          <Link href="/los"
            className="ml-auto px-4 py-2 rounded-xl text-xs font-semibold hover:opacity-80 transition-opacity flex-shrink-0"
            style={{ backgroundColor: 'var(--brand-forest)', color: 'var(--brand-parchment)' }}>{t('profile.viewLos')}</Link>
        </div>
      )}
      {isCore && (
        <Link href="/profile/los-upload"
          style={{ backgroundColor: 'var(--brand-forest)', color: 'var(--brand-parchment)' }}
          className={`rounded-xl px-4 py-3 inline-flex flex-col gap-1 hover:opacity-80 transition-opacity${losSummary ? ' mt-4' : ''}`}>
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--brand-parchment)' }}>{t('profile.uploadLos')}</span>
          <span className="text-[10px] opacity-60" style={{ color: 'var(--brand-parchment)' }}>{t('profile.uploadLosSubtitle')}</span>
        </Link>
      )}
    </div>
  )
}
