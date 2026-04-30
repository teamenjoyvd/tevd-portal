'use client'

import { memo, useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { Drawer } from '@/components/ui/drawer'
import { TravelDocDrawerForm } from './TravelDocDrawerForm'
import { type Profile } from '../types'
import { apiClient } from '@/lib/apiClient'
import { type TranslationKey } from '@/lib/i18n/translations'

// ── Helpers ───────────────────────────────────────────────────────────────────

function validateDocField(
  field: 'doc_number' | 'valid_through',
  value: string,
  context: { has_doc_type: boolean; doc_number: string },
): string {
  if (field === 'doc_number') {
    if (context.has_doc_type && !value.trim()) return 'Required when document type is set'
    return ''
  }
  if (field === 'valid_through') {
    if (!context.doc_number.trim()) return ''
    if (!value.trim()) return 'Required when document number is filled'
    if (isNaN(new Date(value).getTime())) return 'Enter a valid date'
    return ''
  }
  return ''
}

function getExpiryState(validThrough: string | null): 'ok' | 'warning' | 'critical' | null {
  if (!validThrough) return null
  const diffDays = (new Date(validThrough).getTime() - Date.now()) / 86400000
  if (diffDays < 0)   return 'critical'
  if (diffDays < 90)  return 'critical'
  if (diffDays < 180) return 'warning'
  return 'ok'
}

function getExpiryText(
  profile: Profile,
  _expiryState: 'ok' | 'warning' | 'critical' | null,
): string {
  if (!profile.valid_through) return '—'
  return new Date(profile.valid_through).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const EXPIRY_STYLES = {
  ok:       'bg-[#81b29a]/10 border-[#81b29a]/30 text-[#2d6a4f]',
  warning:  'bg-[#f2cc8f]/20 border-[#f2cc8f] text-[#7a5c00]',
  critical: 'bg-[#bc4749]/10 border-[#bc4749]/40 text-[var(--brand-crimson)]',
}

// ── Component ─────────────────────────────────────────────────────────────────

export const TravelDocContent = memo(function TravelDocContent() {
  const qc = useQueryClient()
  const { t } = useLanguage()

  const { data: profile, isLoading } = useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: () => apiClient('/api/profile'),
  })

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [saved, setSaved]           = useState(false)
  const [form, setForm] = useState<{
    document_active_type?: 'id' | 'passport'
    id_number?: string
    passport_number?: string
    valid_through?: string
  }>({})
  const [errors, setErrors] = useState<{ doc_number?: string; valid_through?: string }>({})

  // Seed form once on first profile load
  useEffect(() => {
    if (!profile) return
    setForm({
      document_active_type: profile.document_active_type,
      id_number:            profile.id_number ?? '',
      passport_number:      profile.passport_number ?? '',
      valid_through:        profile.valid_through ?? '',
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  const saveTravelDoc = useMutation({
    mutationFn: async () => {
      const payload = {
        document_active_type: form.document_active_type,
        id_number:       form.id_number       || null,
        passport_number: form.passport_number || null,
        valid_through:   form.valid_through   || null,
      }
      return apiClient<Profile>('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] })
      setSaved(true)
      setDrawerOpen(false)
      setErrors({})
      setTimeout(() => setSaved(false), 2500)
    },
  })

  function handleDocTypeChange(dt: 'id' | 'passport') {
    setForm(f => ({ ...f, document_active_type: dt }))
  }

  function handleDocNumberChange(v: string) {
    const field = form.document_active_type === 'passport' ? 'passport_number' : 'id_number'
    setForm(f => ({ ...f, [field]: v }))
  }

  function handleDocNumberBlur(v: string) {
    const err = validateDocField('doc_number', v, { has_doc_type: !!(form.document_active_type), doc_number: v })
    setErrors(prev => ({ ...prev, doc_number: err }))
  }

  function handleValidThroughBlur(v: string) {
    const docNumber = form.document_active_type === 'passport' ? (form.passport_number ?? '') : (form.id_number ?? '')
    const err = validateDocField('valid_through', v, { has_doc_type: true, doc_number: docNumber })
    setErrors(prev => ({ ...prev, valid_through: err }))
  }

  function clearError(f: 'doc_number' | 'valid_through') {
    setErrors(prev => { const n = { ...prev }; delete n[f]; return n })
  }

  function handleClose() {
    setDrawerOpen(false)
    setErrors({})
    saveTravelDoc.reset()
    // Reset form to current profile data so unsaved edits are discarded
    if (profile) {
      setForm({
        document_active_type: profile.document_active_type,
        id_number:            profile.id_number ?? '',
        passport_number:      profile.passport_number ?? '',
        valid_through:        profile.valid_through ?? '',
      })
    }
  }

  if (isLoading || !profile) {
    return (
      <div className="rounded-2xl p-6 h-full animate-pulse" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="h-3 rounded w-1/2 mb-5" style={{ backgroundColor: 'var(--border-default)' }} />
        <div className="space-y-3">
          <div className="h-3 rounded w-3/4" style={{ backgroundColor: 'var(--border-default)' }} />
          <div className="h-3 rounded w-1/2" style={{ backgroundColor: 'var(--border-default)' }} />
        </div>
      </div>
    )
  }

  const expiryState = getExpiryState(profile.valid_through)
  const docNumber = profile.document_active_type === 'passport'
    ? profile.passport_number
    : profile.id_number

  return (
    <>
      <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-center justify-between mb-5 pr-16">
          <p className="text-xs font-semibold tracking-[0.25em] uppercase" style={{ color: 'var(--brand-crimson)' }}>
            {t('profile.tile.travelDoc')}
          </p>
          <button
            onClick={() => setDrawerOpen(true)}
            className="text-xs font-semibold hover:opacity-70 transition-opacity px-3 py-1.5 rounded-xl border"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            {t('profile.edit')}
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-[10px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              {t('profile.docType.label')}
            </p>
            <span
              className="text-xs font-semibold tracking-widest uppercase px-2 py-1 rounded-lg"
              style={{ backgroundColor: 'var(--bg-global)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
            >
              {profile.document_active_type === 'passport' ? t('profile.docType.passport') : t('profile.docType.id')}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                {t('profile.docNumber')}
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
                {getExpiryText(profile, expiryState)}
              </p>
            </div>
          </div>

          {expiryState && (
            <div className={`mt-2 rounded-xl border px-3 py-2.5 text-xs font-medium ${EXPIRY_STYLES[expiryState]}`}>
              {expiryState === 'ok' ? t('profile.expiry.ok') : expiryState === 'warning' ? t('profile.expiry.warning') : t('profile.expiry.critical')}
            </div>
          )}
        </div>
      </div>

      <Drawer open={drawerOpen} onClose={handleClose} title={t('profile.tile.travelDoc')}>
        <TravelDocDrawerForm
          form={form}
          formErrors={errors}
          onDocTypeChange={handleDocTypeChange}
          onDocNumberChange={handleDocNumberChange}
          onValidThroughChange={v => setForm(f => ({ ...f, valid_through: v }))}
          onDocNumberBlur={handleDocNumberBlur}
          onValidThroughBlur={handleValidThroughBlur}
          onClearError={clearError}
          onCancel={handleClose}
          onSave={() => saveTravelDoc.mutate()}
          isPending={saveTravelDoc.isPending}
          isError={saveTravelDoc.isError}
          errorMessage={saveTravelDoc.isError ? (saveTravelDoc.error as Error).message : ''}
          saved={saved}
        />
      </Drawer>
    </>
  )
})
