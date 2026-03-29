'use client'

import { memo } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'

type Profile = {
  first_name: string
  last_name: string
  display_names: Record<string, string>
  phone: string | null
  contact_email: string | null
}

export const PersonalDetailsContent = memo(function PersonalDetailsContent({
  profile,
  incomplete,
  onEdit,
}: {
  profile: Profile
  incomplete: boolean
  onEdit: () => void
}) {
  const { t } = useLanguage()
  const dn = (profile.display_names ?? {}) as Record<string, string>

  return (
    <div
      className="rounded-2xl p-6 h-full"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: incomplete
          ? '1px solid var(--brand-crimson)'
          : '1px solid var(--border-default)',
      }}
    >
      <div className="flex items-center justify-between mb-5 pr-16">
        <p className="text-xs font-semibold tracking-[0.25em] uppercase" style={{ color: 'var(--brand-crimson)' }}>
          {t('profile.tile.personalDetails')}
        </p>
        <button
          onClick={onEdit}
          className="text-xs font-semibold hover:opacity-70 transition-opacity px-3 py-1.5 rounded-xl border"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
        >
          {t('profile.edit')}
        </button>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              {t('profile.firstName')}
            </p>
            <p className="text-sm font-medium" style={{ color: profile.first_name ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
              {profile.first_name || '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              {t('profile.lastName')}
            </p>
            <p className="text-sm font-medium" style={{ color: profile.last_name ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
              {profile.last_name || '—'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              {t('profile.firstName')} (БГ)
            </p>
            <p className="text-sm" style={{ color: dn.bg_first ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
              {dn.bg_first || '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              {t('profile.lastName')} (БГ)
            </p>
            <p className="text-sm" style={{ color: dn.bg_last ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
              {dn.bg_last || '—'}
            </p>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 12 }}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Phone</p>
              <p className="text-sm" style={{ color: profile.phone ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                {profile.phone || '—'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Email</p>
              <p className="text-sm truncate" style={{ color: profile.contact_email ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                {profile.contact_email || '—'}
              </p>
            </div>
          </div>
        </div>

        {incomplete && (
          <p className="text-[11px] font-medium" style={{ color: 'var(--brand-crimson)' }}>
            {t('profile.incompleteHint')}
          </p>
        )}
      </div>
    </div>
  )
})
