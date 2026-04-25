'use client'

import { memo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { Drawer } from '@/components/ui/drawer'
import { PersonalDrawerForm } from './PersonalDrawerForm'
import { type Profile } from '../types'

// ── Validation ────────────────────────────────────────────────────────────────

type PersonalFormFields = {
  first_name?: string
  last_name?: string
  bg_first?: string
  bg_last?: string
  phone?: string
  contact_email?: string
}

const LATIN_RE    = /^[A-Za-z\-']+$/
const CYRILLIC_RE = /^[\u0400-\u04FF\-']+$/
const PHONE_RE    = /^\+?\d{7,15}$/
const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validatePersonalField(field: keyof PersonalFormFields, value: string): string {
  switch (field) {
    case 'first_name':
      if (!value.trim()) return 'Required'
      if (!LATIN_RE.test(value.trim())) return 'Latin letters, hyphens and apostrophes only'
      return ''
    case 'last_name':
      if (!value.trim()) return 'Required'
      if (!LATIN_RE.test(value.trim())) return 'Latin letters, hyphens and apostrophes only'
      return ''
    case 'bg_first':
      if (!value.trim()) return ''
      if (!CYRILLIC_RE.test(value.trim())) return 'Cyrillic letters, hyphens and apostrophes only'
      return ''
    case 'bg_last':
      if (!value.trim()) return ''
      if (!CYRILLIC_RE.test(value.trim())) return 'Cyrillic letters, hyphens and apostrophes only'
      return ''
    case 'phone':
      if (!value.trim()) return ''
      if (!PHONE_RE.test(value.trim())) return 'Enter a valid phone number (7–15 digits, optional leading +)'
      return ''
    case 'contact_email':
      if (!value.trim()) return ''
      if (!EMAIL_RE.test(value.trim())) return 'Enter a valid email address'
      return ''
    default:
      return ''
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export const PersonalDetailsContent = memo(function PersonalDetailsContent({
  profile,
  incomplete,
}: {
  profile: Profile
  incomplete: boolean
}) {
  const qc = useQueryClient()
  const { t } = useLanguage()
  const dn = (profile.display_names ?? {}) as Record<string, string>

  const [drawerOpen, setDrawerOpen]   = useState(false)
  const [saved, setSaved]             = useState(false)
  const [form, setForm] = useState<{
    first_name?: string
    last_name?: string
    display_names?: Record<string, string>
    phone?: string
    contact_email?: string
  }>(() => ({
    first_name:    profile.first_name,
    last_name:     profile.last_name,
    display_names: profile.display_names ?? {},
    phone:         profile.phone ?? '',
    contact_email: profile.contact_email ?? '',
  }))
  const [errors, setErrors] = useState<Partial<Record<keyof PersonalFormFields, string>>>({})

  const savePersonal = useMutation({
    mutationFn: async () => {
      const payload = {
        first_name:    form.first_name,
        last_name:     form.last_name,
        display_names: form.display_names,
        phone:         form.phone || null,
        contact_email: form.contact_email || null,
      }
      const r = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) throw new Error((await r.json()).error ?? 'Save failed')
      return r.json() as Promise<Profile>
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] })
      setSaved(true)
      setDrawerOpen(false)
      setErrors({})
      setTimeout(() => setSaved(false), 2500)
    },
  })

  function handleChange(field: keyof PersonalFormFields, value: string) {
    if (field === 'bg_first' || field === 'bg_last') {
      setForm(f => ({ ...f, display_names: { ...((f.display_names ?? {}) as Record<string, string>), [field]: value } }))
    } else {
      setForm(f => ({ ...f, [field]: value }))
    }
  }

  function handleBlur(field: keyof PersonalFormFields, value: string) {
    setErrors(prev => ({ ...prev, [field]: validatePersonalField(field, value) }))
  }

  function clearError(field: keyof PersonalFormFields) {
    setErrors(prev => { if (!prev[field]) return prev; const n = { ...prev }; delete n[field]; return n })
  }

  function handleClose() {
    setDrawerOpen(false)
    setErrors({})
    savePersonal.reset()
  }

  return (
    <>
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
            onClick={() => setDrawerOpen(true)}
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
                <p className="text-[10px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{t('profile.phone')}</p>
                <p className="text-sm" style={{ color: profile.phone ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  {profile.phone || '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{t('profile.contactEmail')}</p>
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

      <Drawer open={drawerOpen} onClose={handleClose} title={t('profile.tile.personalDetails')}>
        <PersonalDrawerForm
          form={form}
          formErrors={errors}
          onChange={handleChange}
          onBlur={handleBlur}
          onClearError={clearError}
          onCancel={handleClose}
          onSave={() => savePersonal.mutate()}
          isPending={savePersonal.isPending}
          isError={savePersonal.isError}
          errorMessage={savePersonal.isError ? (savePersonal.error as Error).message : ''}
          saved={saved}
        />
      </Drawer>
    </>
  )
})
