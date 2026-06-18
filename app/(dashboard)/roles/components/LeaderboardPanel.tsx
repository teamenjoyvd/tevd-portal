'use client'

import { useLanguage } from '@/lib/hooks/useLanguage'
import { Database } from '@/types/supabase'

type LeaderboardRow = Database['public']['Views']['member_roles_leaderboard']['Row']

type LeaderboardPanelProps = {
  data: LeaderboardRow[]
}

export default function LeaderboardPanel({ data }: LeaderboardPanelProps) {
  const { t } = useLanguage()

  if (data.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {t('event.roles.leaderboard.empty')}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Desktop view (lg+) */}
      <div
        className="hidden lg:block rounded-2xl overflow-hidden"
        style={{ border: '1px solid rgba(0,0,0,0.07)', backgroundColor: 'var(--bg-card)' }}
      >
        {/* Header row */}
        <div
          className="grid text-[10px] font-semibold tracking-widest uppercase px-4 py-2.5"
          style={{
            gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
            borderBottom: '1px solid rgba(0,0,0,0.06)',
            color: 'var(--text-secondary)',
            backgroundColor: 'rgba(0,0,0,0.02)',
          }}
        >
          <span>{t('event.roles.leaderboard.col.name')}</span>
          <span>{t('event.roles.label.host')}</span>
          <span>{t('event.roles.label.speaker')}</span>
          <span>{t('event.roles.label.products')}</span>
          <span className="text-right pr-4">{t('event.roles.leaderboard.col.total')}</span>
        </div>

        {/* Data rows */}
        {data.map((row, i) => {
          const fullName = [row.first_name, row.last_name].filter(Boolean).join(' ')
          return (
            <div
              key={row.profile_id || i}
              className="grid items-center px-4 py-3 text-sm transition-all"
              style={{
                gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                borderTop: i === 0 ? undefined : '1px solid rgba(0,0,0,0.04)',
              }}
            >
              <span className="font-semibold truncate pr-4" style={{ color: 'var(--text-primary)' }}>
                {fullName}
              </span>
              <span style={{ color: 'var(--text-primary)' }}>{row.host_count ?? 0}</span>
              <span style={{ color: 'var(--text-primary)' }}>{row.speaker_count ?? 0}</span>
              <span style={{ color: 'var(--text-primary)' }}>{row.products_count ?? 0}</span>
              <span className="text-right font-bold pr-4" style={{ color: 'var(--primary-default)' }}>
                {row.total_count ?? 0}
              </span>
            </div>
          )
        })}
      </div>

      {/* Mobile view (< lg, 390px safe) */}
      <div className="lg:hidden flex flex-col gap-3">
        {data.map((row, i) => {
          const fullName = [row.first_name, row.last_name].filter(Boolean).join(' ')
          return (
            <div
              key={row.profile_id || i}
              className="rounded-2xl p-4 transition-all"
              style={{
                border: '1px solid rgba(0,0,0,0.07)',
                backgroundColor: 'var(--bg-card)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {fullName}
                </span>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: 'rgba(var(--primary-default-rgb, 46, 125, 50), 0.1)',
                    color: 'var(--primary-default)',
                  }}
                >
                  {row.total_count ?? 0}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span>
                  {t('event.roles.label.host')}: <strong className="text-primary-default" style={{ color: 'var(--text-primary)' }}>{row.host_count ?? 0}</strong>
                </span>
                <span>
                  {t('event.roles.label.speaker')}: <strong className="text-primary-default" style={{ color: 'var(--text-primary)' }}>{row.speaker_count ?? 0}</strong>
                </span>
                <span>
                  {t('event.roles.label.products')}: <strong className="text-primary-default" style={{ color: 'var(--text-primary)' }}>{row.products_count ?? 0}</strong>
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
