'use client'

import { useQuery } from '@tanstack/react-query'
import { type LosSummaryData } from '../types'

export const STATS_MIN_HEIGHT = 160

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', core: 'Core', member: 'Member', guest: 'Guest',
}

export function StatsSection({ role, aboNumber }: { role: string; aboNumber: string | null }) {
  const { data: losSummary, isLoading } = useQuery<LosSummaryData>({
    queryKey: ['profile-los-summary'],
    queryFn: () => fetch('/api/profile/los-summary').then(r => r.json()),
    enabled: !!aboNumber,
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return <div className="rounded-2xl animate-pulse h-full" style={{ backgroundColor: 'var(--border-default)' }} />
  }

  if (!losSummary) return null

  return (
    <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-4 pr-16" style={{ color: 'var(--brand-crimson)' }}>STATS</p>
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Role</p>
          <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{ROLE_LABELS[role]}</p>
        </div>
        {losSummary.depth !== null && losSummary.depth !== undefined && (
          <div>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Depth</p>
            <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>Level {losSummary.depth}</p>
          </div>
        )}
        <div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Direct downlines</p>
          <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{losSummary.direct_downline_count}</p>
        </div>
        <a href="/los"
          className="ml-auto px-4 py-2 rounded-xl text-xs font-semibold hover:opacity-80 transition-opacity flex-shrink-0"
          style={{ backgroundColor: 'var(--brand-forest)', color: 'var(--brand-parchment)' }}>VIEW LOS</a>
      </div>
    </div>
  )
}
