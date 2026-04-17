'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { t } from '@/lib/i18n'

export type EmailConfig = {
  enabled: boolean
  notification_types: Record<string, boolean>
  alert_recipient: string
}

const TEMPLATES = [
  { id: 'welcome' },
  { id: 'payment_status' },
  { id: 'doc_expiry' },
  { id: 'abo_verification_result' },
  { id: 'trip_registration_status' },
]

export function EmailSettingsPanel({ initialConfig }: { initialConfig: EmailConfig }) {
  const [config, setConfig] = useState<EmailConfig>(initialConfig)

  const mutation = useMutation({
    mutationFn: (newConfig: EmailConfig) =>
      fetch('/api/admin/settings/email', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      }).then(r => {
        if (!r.ok) throw new Error('Failed to update settings')
        return r.json()
      }),
    onSuccess: () => toast.success('Email settings updated successfully'),
    onError: () => toast.error('Failed to update email settings'),
  })

  const toggleAll = (val: boolean) => {
    const updated = { ...config, enabled: val }
    setConfig(updated)
    mutation.mutate(updated)
  }

  const toggleType = (id: string, val: boolean) => {
    const updated = {
      ...config,
      notification_types: { ...config.notification_types, [id]: val },
    }
    setConfig(updated)
    mutation.mutate(updated)
  }

  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)] p-6 w-full shadow-sm flex flex-col gap-8">
      <div className="flex items-center justify-between pb-6 border-b border-[var(--border-subtle)]">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-[var(--semantic-fg-primary)]">{t('admin.settings.emailPanel.globalTitle', 'en')}</h3>
          <p className="text-xs text-[var(--semantic-fg-secondary)]">{t('admin.settings.emailPanel.globalDesc', 'en')}</p>
        </div>
        <button
          onClick={() => toggleAll(!config.enabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${config.enabled ? 'bg-green-600' : 'bg-gray-200'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-[var(--semantic-fg-primary)]">{t('admin.settings.emailPanel.recipientTitle', 'en')}</label>
          <p className="text-xs text-[var(--semantic-fg-secondary)]">{t('admin.settings.emailPanel.recipientDesc', 'en')}</p>
        </div>
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="admin@example.com"
            className="flex-1 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--semantic-fg-primary)] focus:outline-none focus:ring-1 focus:ring-black/10 transition-all"
            value={config.alert_recipient}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, alert_recipient: e.target.value })}
          />
          <button
            onClick={() => mutation.mutate(config)}
            disabled={mutation.isPending}
            className="px-4 py-2 bg-[var(--semantic-fg-primary)] text-[var(--bg-card)] rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {t('admin.settings.emailPanel.btn.save', 'en')}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-[var(--semantic-fg-primary)]">{t('admin.settings.emailPanel.automatedTitle', 'en')}</h3>
        <div className="grid gap-3">
          {TEMPLATES.map(tmpl => (
            <div key={tmpl.id} className="flex items-center justify-between p-3 rounded-lg border border-[var(--border-subtle)] hover:bg-black/[0.02] transition-colors">
              <span className="text-xs font-medium text-[var(--semantic-fg-secondary)]">{t(`admin.settings.emailPanel.template.${tmpl.id}` as Parameters<typeof t>[0], 'en')}</span>
              <button
                onClick={() => toggleType(tmpl.id, !(config.notification_types?.[tmpl.id] !== false))}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${config.notification_types?.[tmpl.id] !== false ? 'bg-green-600' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${config.notification_types?.[tmpl.id] !== false ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
