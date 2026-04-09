'use client'

import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { type NotificationPrefs } from '../types'

export const EMAIL_PREFS_MIN_HEIGHT = 280

type PrefKey = keyof NotificationPrefs

interface PrefRow {
  key:  PrefKey
  labelEn: string
  labelBg: string
}

const PREF_ROWS: PrefRow[] = [
  { key: 'trip_registration_status',  labelEn: 'Trip registration updates',    labelBg: 'Промени по регистрация за пътуване' },
  { key: 'payment_status',            labelEn: 'Payment status updates',       labelBg: 'Промени по статус на плащане'       },
  { key: 'abo_verification_result',   labelEn: 'ABO verification result',      labelBg: 'Резултат от ABO верификация'        },
  { key: 'event_role_request_result', labelEn: 'Event role request result',    labelBg: 'Резултат от заявка за роля'         },
  { key: 'document_expiring_soon',    labelEn: 'Document expiry warnings',     labelBg: 'Предупреждения за изтичащ документ' },
]

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
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

export function EmailPrefsSection({ prefs }: { prefs: NotificationPrefs }) {
  const { lang } = useLanguage()
  const qc = useQueryClient()

  const [local, setLocal] = useState<NotificationPrefs>(prefs)
  const [saved, setSaved]   = useState(false)

  const save = useMutation({
    mutationFn: (next: NotificationPrefs) =>
      fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_prefs: next }),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
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
      <div className="flex items-center justify-between mb-4 pr-16">
        <p className="text-xs font-semibold tracking-[0.25em] uppercase" style={{ color: 'var(--brand-crimson)' }}>
          {lang === 'bg' ? 'Имейл известия' : 'Email Notifications'}
        </p>
        {saved && (
          <span className="text-xs font-medium" style={{ color: 'var(--brand-forest)' }}>
            {lang === 'bg' ? 'Запазено ✓' : 'Saved ✓'}
          </span>
        )}
        {save.isError && (
          <span className="text-xs font-medium" style={{ color: 'var(--brand-crimson)' }}>
            {lang === 'bg' ? 'Грешка' : 'Error'}
          </span>
        )}
      </div>

      {/* Rows */}
      <div className="space-y-3">
        {PREF_ROWS.map(row => (
          <div key={row.key} className="flex items-center justify-between gap-4">
            <span className="text-sm leading-snug" style={{ color: 'var(--text-primary)' }}>
              {lang === 'bg' ? row.labelBg : row.labelEn}
            </span>
            <Toggle enabled={local[row.key]} onToggle={() => handleToggle(row.key)} />
          </div>
        ))}
      </div>

      <p className="text-[11px] mt-5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {lang === 'bg'
          ? 'Имейлите се изпращат само на вашия контактен адрес.'
          : 'Emails are sent only to your contact email address.'}
      </p>
    </div>
  )
}
