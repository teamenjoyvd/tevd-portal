'use client'

import { useLanguage } from '@/lib/hooks/useLanguage'
import { StatusBadge } from './StatusBadge'
import { EXPIRY_TOKEN } from '../types'

function getExpiryState(validThrough: string | null): 'ok' | 'warning' | 'critical' | null {
  if (!validThrough) return null
  const diffDays = (new Date(validThrough).getTime() - Date.now()) / 86400000
  if (diffDays < 0)   return 'critical'
  if (diffDays < 90)  return 'critical'
  if (diffDays < 180) return 'warning'
  return 'ok'
}

export function TravelDocDrawerForm({
  form,
  formErrors,
  onDocTypeChange,
  onDocNumberChange,
  onValidThroughChange,
  onDocNumberBlur,
  onValidThroughBlur,
  onClearError,
  onCancel,
  onSave,
  isPending,
  isError,
  errorMessage,
  saved,
}: {
  form: {
    document_active_type?: 'id' | 'passport'
    id_number?: string
    passport_number?: string
    valid_through?: string
  }
  formErrors: { doc_number?: string; valid_through?: string }
  onDocTypeChange: (t: 'id' | 'passport') => void
  onDocNumberChange: (v: string) => void
  onValidThroughChange: (v: string) => void
  onDocNumberBlur: (v: string) => void
  onValidThroughBlur: (v: string) => void
  onClearError: (f: 'doc_number' | 'valid_through') => void
  onCancel: () => void
  onSave: () => void
  isPending: boolean
  isError: boolean
  errorMessage: string
  saved: boolean
}) {
  const { t } = useLanguage()
  const activeDocType = form.document_active_type ?? 'id'
  const docNumber = activeDocType === 'passport' ? (form.passport_number ?? '') : (form.id_number ?? '')
  const expiryState = getExpiryState(form.valid_through ?? null)

  const EXPIRY_LABELS = {
    ok:       t('profile.expiry.ok'),
    warning:  t('profile.expiry.warning'),
    critical: t('profile.expiry.critical'),
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['id', 'passport'] as const).map(dt => (
          <button
            key={dt}
            onClick={() => onDocTypeChange(dt)}
            className="flex-1 py-2 rounded-xl text-xs font-semibold tracking-widest uppercase transition-all"
            style={{
              backgroundColor: activeDocType === dt ? 'var(--text-primary)' : 'transparent',
              color: activeDocType === dt ? 'var(--bg-card)' : 'var(--text-secondary)',
              border: '1px solid var(--border-default)',
              cursor: 'pointer',
            }}
          >
            {dt === 'id' ? t('profile.docType.id') : t('profile.docType.passport')}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
            {activeDocType === 'passport' ? t('profile.passportNumber') : t('profile.idNumber')}
          </label>
          <input
            value={docNumber}
            onChange={e => { onDocNumberChange(e.target.value); onClearError('doc_number') }}
            onBlur={e => onDocNumberBlur(e.target.value)}
            className="w-full border border-border-default rounded-xl px-3 py-2.5 text-sm font-mono"
            style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)', borderColor: formErrors.doc_number ? 'var(--brand-crimson)' : undefined }}
          />
          {formErrors.doc_number && <p className="text-[11px] mt-1" style={{ color: 'var(--status-alert-fg)' }}>{formErrors.doc_number}</p>}
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
            {t('profile.validThrough')}
          </label>
          <input
            type="date"
            value={form.valid_through ?? ''}
            onChange={e => { onValidThroughChange(e.target.value); onClearError('valid_through') }}
            onBlur={e => onValidThroughBlur(e.target.value)}
            className="w-full border border-border-default rounded-xl px-3 py-2.5 text-sm"
            style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)', borderColor: formErrors.valid_through ? 'var(--brand-crimson)' : undefined }}
          />
          {formErrors.valid_through && <p className="text-[11px] mt-1" style={{ color: 'var(--status-alert-fg)' }}>{formErrors.valid_through}</p>}
        </div>
      </div>

      {expiryState && (
        <StatusBadge
          status={EXPIRY_TOKEN[expiryState]}
          className="block w-full rounded-xl border px-4 py-3 text-sm font-medium"
          style={{ borderColor: `color-mix(in srgb, var(--status-${EXPIRY_TOKEN[expiryState]}-fg) 35%, transparent)` }}
        >
          {EXPIRY_LABELS[expiryState]}
          {form.valid_through && (
            <span className="font-normal ml-1 opacity-70">
              · {new Date(form.valid_through).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </span>
          )}
        </StatusBadge>
      )}

      {isError && (
        <p className="text-xs" style={{ color: 'var(--status-alert-fg)' }}>{errorMessage}</p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold border hover:bg-hover-surface transition-colors"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
        >
          {t('profile.cancel')}
        </button>
        <button
          onClick={onSave}
          disabled={isPending || Object.values(formErrors).some(Boolean)}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-on-accent disabled:opacity-50 hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--brand-crimson)' }}
        >
          {isPending ? t('profile.saving') : saved ? t('profile.saved') : t('profile.saveChanges')}
        </button>
      </div>
    </div>
  )
}
