'use client'

import { memo } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { formatDate } from '@/lib/format'

type Profile = {
  document_active_type: 'id' | 'passport'
  id_number: string | null
  passport_number: string | null
  valid_through: string | null
}

function getExpiryState(validThrough: string | null): 'ok' | 'warning' | 'critical' | null {
  if (!validThrough) return null
  const diffDays = (new Date(validThrough).getTime() - Date.now()) / 86400000
  if (diffDays < 0)   return 'critical'
  if (diffDays < 90)  return 'critical'
  if (diffDays < 180) return 'warning'
  return 'ok'
}

const EXPIRY_STYLES = {
  ok:       'bg-[#81b29a]/10 border-[#81b29a]/30 text-[#2d6a4f]',
  warning:  'bg-[#f2cc8f]/20 border-[#f2cc8f] text-[#7a5c00]',
  critical: 'bg-[#bc4749]/10 border-[#bc4749]/40 text-[var(--brand-crimson)]',
}

export const TravelDocContent = memo(function TravelDocContent({
  profile,
  onEdit,
}: {
  profile: Profile
  onEdit: () => void
}) {
  const { t } = useLanguage()
  const expiryState = getExpiryState(profile.valid_through)
  const docNumber = profile.document_active_type === 'passport'
    ? profile.passport_number
    : profile.id_number

  const EXPIRY_LABELS = {
    ok:       t('profile.expiry.ok'),
    warning:  t('profile.expiry.warning'),
    critical: t('profile.expiry.critical'),
  }

  return (
    <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      <div className="flex items-center justify-between mb-5 pr-16">
        <p className="text-xs font-semibold tracking-[0.25em] uppercase" style={{ color: 'var(--brand-crimson)' }}>
          {t('profile.tile.travelDoc')}
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
        <div>
          <p className="text-[10px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            {t('profile.travelDoc')}
          </p>
          <span
            className="text-xs font-semibold tracking-widest uppercase px-2 py-1 rounded-lg"
            style={{ backgroundColor: 'var(--bg-global)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
          >
            {profile.document_active_type === 'passport' ? 'Passport' : 'Personal ID'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              {profile.document_active_type === 'passport' ? t('profile.passportNumber') : t('profile.idNumber')}
            </p>
            <p className="text-sm font-mono" style={{ color: docNumber ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
              {docNumber || '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              {t('profile.validThrough')}
            </p>
            <p className="text-sm" style={{ color: profile.valid_through ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
              {profile.valid_through ? formatDate(profile.valid_through) : '—'}
            </p>
          </div>
        </div>

        {expiryState && (
          <div className={`mt-2 rounded-xl border px-3 py-2.5 text-xs font-medium ${EXPIRY_STYLES[expiryState]}`}>
            {EXPIRY_LABELS[expiryState]}
            {profile.valid_through && (
              <span className="font-normal ml-1 opacity-70">
                · {new Date(profile.valid_through).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
})
