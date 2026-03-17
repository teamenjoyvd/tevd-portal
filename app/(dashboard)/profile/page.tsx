'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import PageHeading from '@/components/layout/PageHeading'
import PageContainer from '@/components/layout/PageContainer'

type Profile = {
  id: string
  clerk_id: string
  first_name: string
  last_name: string
  abo_number: string | null
  role: 'admin' | 'core' | 'member' | 'guest'
  document_active_type: 'id' | 'passport'
  id_number: string | null
  passport_number: string | null
  valid_through: string | null
  display_names: Record<string, string>
  created_at: string
}

type VerificationRequest = {
  id: string
  claimed_abo: string
  claimed_upline_abo: string
  status: 'pending' | 'approved' | 'denied'
  admin_note: string | null
  created_at: string
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

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', core: 'Core', member: 'Member', guest: 'Guest',
}

export default function ProfilePage() {
  const qc = useQueryClient()
  const { t } = useLanguage()
  const [form, setForm] = useState<Partial<Profile>>({})
  const [saved, setSaved] = useState(false)
  const [aboInput, setAboInput] = useState('')
  const [uplineInput, setUplineInput] = useState('')

  const EXPIRY_LABELS = {
    ok:       t('profile.expiry.ok'),
    warning:  t('profile.expiry.warning'),
    critical: t('profile.expiry.critical'),
  }

  const ROLE_DESCRIPTIONS: Record<string, string> = {
    guest:  t('profile.role.desc.guest'),
    member: t('profile.role.desc.member'),
    core:   t('profile.role.desc.core'),
    admin:  t('profile.role.desc.admin'),
  }

  const { data: profile, isLoading } = useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: () => fetch('/api/profile').then(r => r.json()),
  })

  const { data: verRequest } = useQuery<VerificationRequest | null>({
    queryKey: ['verify-abo'],
    queryFn: () => fetch('/api/profile/verify-abo').then(r => r.json()),
    enabled: profile?.role === 'guest' && !profile?.abo_number,
  })

  useEffect(() => {
    if (profile) setForm({
      first_name:           profile.first_name,
      last_name:            profile.last_name,
      document_active_type: profile.document_active_type,
      id_number:            profile.id_number ?? '',
      passport_number:      profile.passport_number ?? '',
      valid_through:        profile.valid_through ?? '',
    })
  }, [profile])

  const saveMutation = useMutation({
    mutationFn: (body: Partial<Profile>) =>
      fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: (data) => {
      qc.setQueryData(['profile'], data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  const toggleDoc = useMutation({
    mutationFn: (type: 'id' | 'passport') =>
      fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_active_type: type }),
      }).then(r => r.json()),
    onSuccess: (data) => {
      qc.setQueryData(['profile'], data)
      setForm(f => ({ ...f, document_active_type: data.document_active_type }))
    },
  })

  const submitVerification = useMutation({
    mutationFn: () =>
      fetch('/api/profile/verify-abo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimed_abo: aboInput.trim(), claimed_upline_abo: uplineInput.trim() }),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['verify-abo'] })
      setAboInput('')
      setUplineInput('')
    },
  })

  const cancelVerification = useMutation({
    mutationFn: () =>
      fetch('/api/profile/verify-abo', { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['verify-abo'] }),
  })

  const activeDocType = form.document_active_type ?? profile?.document_active_type ?? 'id'
  const expiryState   = getExpiryState(form.valid_through ?? profile?.valid_through ?? null)
  const isGuest       = profile?.role === 'guest' && !profile?.abo_number

  return (
    <>
      <PageHeading title="My Profile" subtitle="Account details and travel documents" />
      <PageContainer>
        <div className="max-w-xl py-8 pb-16">

          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 rounded-2xl animate-pulse"
                  style={{ backgroundColor: 'rgba(0,0,0,0.06)' }} />
              ))}
            </div>
          ) : !profile ? null : (
            <div className="space-y-4">

              {/* Identity */}
              <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                <p className="text-xs font-semibold tracking-widest uppercase mb-4"
                  style={{ color: 'var(--text-secondary)' }}>
                  {t('profile.identity')}
                </p>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                      {t('profile.firstName')}
                    </label>
                    <input
                      value={form.first_name ?? ''}
                      onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                      className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                      style={{ color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                      {t('profile.lastName')}
                    </label>
                    <input
                      value={form.last_name ?? ''}
                      onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                      className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                      style={{ color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {profile.abo_number && (
                    <span>
                      ABO:{' '}
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {profile.abo_number}
                      </span>
                    </span>
                  )}
                  <span>
                    {t('profile.role')}:{' '}
                    <span
                      className="font-semibold px-2 py-0.5 rounded-full text-xs"
                      style={{
                        backgroundColor: profile.role === 'guest' ? 'rgba(0,0,0,0.06)' : '#81b29a33',
                        color: profile.role === 'guest' ? 'var(--text-secondary)' : '#2d6a4f',
                      }}
                    >
                      {ROLE_LABELS[profile.role]}
                    </span>
                  </span>
                </div>
                {ROLE_DESCRIPTIONS[profile.role] && (
                  <p className="text-xs mt-3" style={{ color: 'var(--text-secondary)' }}>
                    {ROLE_DESCRIPTIONS[profile.role]}
                  </p>
                )}
              </div>

              {/* ABO Verification — guests only */}
              {isGuest && (
                <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                  <p className="text-xs font-semibold tracking-widest uppercase mb-1"
                    style={{ color: 'var(--text-secondary)' }}>
                    {t('profile.aboVerification')}
                  </p>
                  <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
                    {t('profile.aboVerifDesc')}
                  </p>

                  {verRequest?.status === 'pending' ? (
                    <div className="rounded-xl px-4 py-3"
                      style={{ backgroundColor: '#f2cc8f33' }}>
                      <p className="text-sm font-medium" style={{ color: '#7a5c00' }}>
                        {t('profile.verifPending')}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: '#7a5c00' }}>
                        ABO {verRequest.claimed_abo} · Upline {verRequest.claimed_upline_abo}
                      </p>
                      <button
                        onClick={() => cancelVerification.mutate()}
                        disabled={cancelVerification.isPending}
                        className="text-xs mt-2 font-medium hover:underline disabled:opacity-50"
                        style={{ color: 'var(--brand-crimson)' }}
                      >
                        {t('profile.cancelRequest')}
                      </button>
                    </div>
                  ) : verRequest?.status === 'denied' ? (
                    <div className="rounded-xl px-4 py-3 mb-4"
                      style={{ backgroundColor: '#bc474915' }}>
                      <p className="text-sm font-medium" style={{ color: 'var(--brand-crimson)' }}>
                        {t('profile.prevDenied')}
                      </p>
                      {verRequest.admin_note && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--brand-crimson)' }}>
                          {verRequest.admin_note}
                        </p>
                      )}
                      <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {t('profile.checkDetails')}
                      </p>
                    </div>
                  ) : null}

                  {(!verRequest || verRequest.status === 'denied') && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                          {t('profile.yourAbo')}
                        </label>
                        <input
                          value={aboInput}
                          onChange={e => setAboInput(e.target.value)}
                          placeholder="e.g. 7023040472"
                          className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm font-mono"
                          style={{ color: 'var(--text-primary)' }}
                        />
                      </div>
                      <div>
                        <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                          {t('profile.sponsorAbo')}
                        </label>
                        <input
                          value={uplineInput}
                          onChange={e => setUplineInput(e.target.value)}
                          placeholder="e.g. 7010970187"
                          className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm font-mono"
                          style={{ color: 'var(--text-primary)' }}
                        />
                      </div>
                      {submitVerification.isError && (
                        <p className="text-xs" style={{ color: 'var(--brand-crimson)' }}>
                          {(submitVerification.error as Error).message}
                        </p>
                      )}
                      <button
                        onClick={() => submitVerification.mutate()}
                        disabled={submitVerification.isPending || !aboInput || !uplineInput}
                        className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: 'var(--text-primary)' }}
                      >
                        {submitVerification.isPending ? t('profile.submitting') : t('profile.submitVerif')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Travel document */}
              <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                <p className="text-xs font-semibold tracking-widest uppercase mb-4"
                  style={{ color: 'var(--text-secondary)' }}>
                  {t('profile.travelDoc')}
                </p>
                <div className="flex gap-2 mb-5">
                  {(['id', 'passport'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => toggleDoc.mutate(type)}
                      className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: activeDocType === type ? 'var(--brand-forest)' : 'rgba(0,0,0,0.05)',
                        color: activeDocType === type ? 'var(--brand-parchment)' : 'var(--text-secondary)',
                      }}
                    >
                      {type === 'id' ? t('profile.nationalId') : t('profile.passport')}
                    </button>
                  ))}
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                      {activeDocType === 'passport' ? t('profile.passportNumber') : t('profile.idNumber')}
                    </label>
                    <input
                      value={activeDocType === 'passport'
                        ? (form.passport_number ?? '')
                        : (form.id_number ?? '')}
                      onChange={e => setForm(f => ({
                        ...f,
                        [activeDocType === 'passport' ? 'passport_number' : 'id_number']: e.target.value,
                      }))}
                      className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm font-mono"
                      style={{ color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                      {t('profile.validThrough')}
                    </label>
                    <input
                      type="date"
                      value={form.valid_through ?? ''}
                      onChange={e => setForm(f => ({ ...f, valid_through: e.target.value }))}
                      className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                      style={{ color: 'var(--text-primary)' }}
                    />
                  </div>
                  {expiryState && (
                    <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${EXPIRY_STYLES[expiryState]}`}>
                      {EXPIRY_LABELS[expiryState]}
                      {form.valid_through && (
                        <span className="font-normal ml-1 opacity-70">
                          · {new Date(form.valid_through).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'long', year: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Save */}
              <button
                onClick={() => saveMutation.mutate(form)}
                disabled={saveMutation.isPending}
                className="w-full py-3 rounded-2xl text-sm font-semibold text-white disabled:opacity-50 transition-all hover:opacity-90 active:scale-[0.99]"
                style={{ backgroundColor: 'var(--brand-crimson)' }}
              >
                {saveMutation.isPending ? t('profile.saving') : saved ? t('profile.saved') : t('profile.saveChanges')}
              </button>

            </div>
          )}
        </div>
      </PageContainer>
    </>
  )
}
