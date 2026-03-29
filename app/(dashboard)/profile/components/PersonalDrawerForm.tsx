'use client'

import { useLanguage } from '@/lib/hooks/useLanguage'

type PersonalFormFields = {
  first_name?: string
  last_name?: string
  bg_first?: string
  bg_last?: string
  phone?: string
  contact_email?: string
}

export function PersonalDrawerForm({
  form,
  formErrors,
  onChange,
  onBlur,
  onClearError,
  onCancel,
  onSave,
  isPending,
  isError,
  errorMessage,
  saved,
}: {
  form: {
    first_name?: string
    last_name?: string
    display_names?: Record<string, string>
    phone?: string
    contact_email?: string
  }
  formErrors: Partial<Record<keyof PersonalFormFields, string>>
  onChange: (field: keyof PersonalFormFields, value: string) => void
  onBlur: (field: keyof PersonalFormFields, value: string) => void
  onClearError: (field: keyof PersonalFormFields) => void
  onCancel: () => void
  onSave: () => void
  isPending: boolean
  isError: boolean
  errorMessage: string
  saved: boolean
}) {
  const { t } = useLanguage()
  const dn = (form.display_names ?? {}) as Record<string, string>

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
            {t('profile.firstName')}
          </label>
          <input
            value={form.first_name ?? ''}
            onChange={e => { onChange('first_name', e.target.value); onClearError('first_name') }}
            onBlur={e => onBlur('first_name', e.target.value)}
            className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
            style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)', borderColor: formErrors.first_name ? 'var(--brand-crimson)' : undefined }}
          />
          {formErrors.first_name && <p className="text-[11px] mt-1" style={{ color: 'var(--brand-crimson)' }}>{formErrors.first_name}</p>}
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
            {t('profile.lastName')}
          </label>
          <input
            value={form.last_name ?? ''}
            onChange={e => { onChange('last_name', e.target.value); onClearError('last_name') }}
            onBlur={e => onBlur('last_name', e.target.value)}
            className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
            style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)', borderColor: formErrors.last_name ? 'var(--brand-crimson)' : undefined }}
          />
          {formErrors.last_name && <p className="text-[11px] mt-1" style={{ color: 'var(--brand-crimson)' }}>{formErrors.last_name}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
            {t('profile.firstName')} (БГ)
          </label>
          <input
            value={dn.bg_first ?? ''}
            onChange={e => { onChange('bg_first', e.target.value); onClearError('bg_first') }}
            onBlur={e => onBlur('bg_first', e.target.value)}
            className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
            style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)', borderColor: formErrors.bg_first ? 'var(--brand-crimson)' : undefined }}
          />
          {formErrors.bg_first && <p className="text-[11px] mt-1" style={{ color: 'var(--brand-crimson)' }}>{formErrors.bg_first}</p>}
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
            {t('profile.lastName')} (БГ)
          </label>
          <input
            value={dn.bg_last ?? ''}
            onChange={e => { onChange('bg_last', e.target.value); onClearError('bg_last') }}
            onBlur={e => onBlur('bg_last', e.target.value)}
            className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
            style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)', borderColor: formErrors.bg_last ? 'var(--brand-crimson)' : undefined }}
          />
          {formErrors.bg_last && <p className="text-[11px] mt-1" style={{ color: 'var(--brand-crimson)' }}>{formErrors.bg_last}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Phone</label>
          <input
            value={form.phone ?? ''}
            onChange={e => { onChange('phone', e.target.value); onClearError('phone') }}
            onBlur={e => onBlur('phone', e.target.value)}
            placeholder="+359 88 000 0000"
            className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
            style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)', borderColor: formErrors.phone ? 'var(--brand-crimson)' : undefined }}
          />
          {formErrors.phone && <p className="text-[11px] mt-1" style={{ color: 'var(--brand-crimson)' }}>{formErrors.phone}</p>}
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Contact email</label>
          <input
            value={form.contact_email ?? ''}
            onChange={e => { onChange('contact_email', e.target.value); onClearError('contact_email') }}
            onBlur={e => onBlur('contact_email', e.target.value)}
            placeholder="your@email.com"
            className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
            style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)', borderColor: formErrors.contact_email ? 'var(--brand-crimson)' : undefined }}
          />
          {formErrors.contact_email && <p className="text-[11px] mt-1" style={{ color: 'var(--brand-crimson)' }}>{formErrors.contact_email}</p>}
        </div>
      </div>

      {isError && (
        <p className="text-xs" style={{ color: 'var(--brand-crimson)' }}>{errorMessage}</p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold border hover:bg-black/5 transition-colors"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={isPending || Object.values(formErrors).some(Boolean)}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--brand-crimson)' }}
        >
          {isPending ? t('profile.saving') : saved ? t('profile.saved') : t('profile.saveChanges')}
        </button>
      </div>
    </div>
  )
}
