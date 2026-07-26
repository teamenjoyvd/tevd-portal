'use client'

import { useState, useCallback, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Mail } from 'lucide-react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { Switch } from '@/components/ui/switch'
import { BentoHeader } from './BentoHeader'
import { type NotificationPrefs, DEFAULT_NOTIFICATION_PREFS } from '../types'
import { apiClient } from '@/lib/apiClient'
import { useProfile } from '../useProfile'

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

export function EmailPrefsSection() {
  const { t } = useLanguage()
  const qc = useQueryClient()

  const { data: profile } = useProfile()
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
  }, [save.mutate])

  return (
    <div>
      <BentoHeader
        icon={Mail}
        title={t('profile.emailNotifications')}
        action={
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
        }
      />

      {/* Rows */}
      <div className="space-y-3">
        {PREF_ROWS.map(row => (
          <div key={row.key} className="flex items-center justify-between gap-4">
            <span className="text-sm leading-snug" style={{ color: 'var(--text-primary)' }}>
              {t(row.labelKey as Parameters<typeof t>[0])}
            </span>
            <Switch
              aria-label={t(row.labelKey as Parameters<typeof t>[0])}
              checked={local[row.key]}
              onCheckedChange={() => handleToggle(row.key)}
              className="shrink-0"
            />
          </div>
        ))}
      </div>

      <p className="text-[11px] mt-5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {t('profile.emailOnlyNote')}
      </p>
    </div>
  )
}
