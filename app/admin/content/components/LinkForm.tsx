'use client'

import { useState } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'

export const ALL_ROLES = ['guest', 'member', 'core', 'admin']

export type LinkFormData = {
  label: { en: string; bg: string }
  url: string
  access_roles: string[]
}

export function LinkForm({
  initial,
  onSave,
  isPending,
  submitLabel,
}: {
  initial: LinkFormData
  onSave: (data: LinkFormData) => void
  isPending: boolean
  submitLabel: string
}) {
  const { t } = useLanguage()
  const [form, setForm] = useState<LinkFormData>(initial)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest mb-1 block" style={{ color: 'var(--text-secondary)' }}>
            {t('admin.content.links.lbl.labelEn')}
          </label>
          <input
            value={form.label.en}
            onChange={e => setForm(f => ({ ...f, label: { ...f.label, en: e.target.value } }))}
            placeholder={t('admin.content.links.placeholder.labelEn')}
            className="w-full border rounded-xl px-3 py-2.5 text-sm"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest mb-1 block" style={{ color: 'var(--text-secondary)' }}>
            {t('admin.content.links.lbl.labelBg')}
          </label>
          <input
            value={form.label.bg}
            onChange={e => setForm(f => ({ ...f, label: { ...f.label, bg: e.target.value } }))}
            placeholder={t('admin.content.links.placeholder.labelBg')}
            className="w-full border rounded-xl px-3 py-2.5 text-sm"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-widest mb-1 block" style={{ color: 'var(--text-secondary)' }}>
          {t('admin.content.links.lbl.url')}
        </label>
        <input
          value={form.url}
          onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
          placeholder="https://…"
          className="w-full border rounded-xl px-3 py-2.5 text-sm"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
        />
      </div>
      <div className="flex gap-2 flex-wrap">
        {ALL_ROLES.map(role => (
          <button
            key={role}
            onClick={() => setForm(f => ({
              ...f,
              access_roles: f.access_roles.includes(role)
                ? f.access_roles.filter(r => r !== role)
                : [...f.access_roles, role],
            }))}
            className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
            style={{
              backgroundColor: form.access_roles.includes(role) ? 'var(--brand-forest)' : 'rgba(0,0,0,0.06)',
              color: form.access_roles.includes(role) ? 'var(--brand-parchment)' : 'var(--text-secondary)',
            }}
          >
            {role}
          </button>
        ))}
      </div>
      <button
        onClick={() => onSave(form)}
        disabled={isPending || !form.label.en || !form.url}
        className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
        style={{ backgroundColor: 'var(--brand-crimson)' }}
      >
        {submitLabel}
      </button>
    </div>
  )
}
