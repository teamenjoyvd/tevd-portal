'use client'

import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { type Profile, type NotificationPrefs, DEFAULT_NOTIFICATION_PREFS } from '../types'
import { apiClient } from '@/lib/apiClient'

export const EMAIL_PREFS_MIN_HEIGHT = 280

type PrefKey = keyof NotificationPrefs

interface PrefRow {
  key:      PrefKey
  labelKey: string
}

const PREF_ROWS: PrefRow[] = [
  { key: 'trip_registration_status',  labelKey: 'profile.pref.tripReg'      },
  { key: 'payment_status',            labelKey: 'profile.pref.paymentStatus' },
  { key: 'abo_verification_result',   labelKey: 'profile.pref.aboVerif'      },
  { key: 'event_role_request_result', labelKey: 'profile.pref.eventRole'     },
  { key: 'document_expiring_soon',    labelKey: 'profile.pref.docExpiry'     },
]

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className="relative flex-shrink-0 transition-colors"
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        backgroundColor: enabled ? 'var(--brand-forest)' : 'var(--border-default)',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: enabled ? 21 : 3,
          width: 16,
          height: 16,
          borderRadius: '50%',
          backgroundColor: '#fff',
          transition: 'left 150ms ease',
        }}
      />
    </button>
  )
}

export function EmailPrefsSection() {
  const { t } = useLanguage()
  const qc = useQueryClient()

  const { data: profile } = useQuery<Profile>({ queryKey: ['profile'] })
  const prefs = profile?.notification_prefs ?? DEFAULT_NOTIFICATION_PREFS

  const [local, setLocal] = useState<NotificationPrefs>(prefs)
  const [saved, setSaved] = useState(false)

  // Sync local toggle state when the profile cache is refreshed externally
  // (e.g. after a save invalidation or background refetch).
  useEffect(() => {
    setLocal(profile?.notification_prefs ?? DEFAULT_NOTIFICATION_PREFS)
  }, [profile])

  const save = useMutation({
    mutationFn: (next: NotificationPrefs) =>
      apiClient('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ notification_prefs: next }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    },
  })

  const handleToggle = useCallback((key: PrefKey) => {
    setLocal(prev => {
      const next = { ...prev, [key]: !prev[key] }
      save.mutate(next)
      return next
    })
  }, [save])

  return (
    <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      {/* Eyebrow */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold tracking-[0.25em] uppercase" style={{ color: 'var(--brand-crimson)' }}>
          {t('profile.emailNotifications')}
        </p>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-xs font-medium" style={{ color: 'var(--brand-forest)' }}>
              {t('profile.saved')}
            </span>
          )}
          {save.isError && (
            <span className="text-xs font-medium" style={{ color: 'var(--brand-crimson)' }}>
              {t('profile.error')}
            </span>
          )}
        </div>
      </div>

      {/* Rows */}
      <div className="space-y-3">
        {PREF_ROWS.map(row => (
          <div key={row.key} className="flex items-center justify-between gap-4">
            <span className="text-sm leading-snug" style={{ color: 'var(--text-primary)' }}>
              {t(row.labelKey as Parameters<typeof t>[0])}
            </span>
            <Toggle enabled={local[row.key]} onToggle={() => handleToggle(row.key)} />
          </div>
        ))}
      </div>

      <p className="text-[11px] mt-5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {t('profile.emailOnlyNote')}
      </p>
    </div>
  )
}
