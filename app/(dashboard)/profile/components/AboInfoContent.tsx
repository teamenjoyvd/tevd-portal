'use client'

import { memo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { getRoleColors } from '@/lib/role-colors'
import { type VerificationRequest, type UplineData, type Profile } from '../types'
import { apiClient } from '@/lib/apiClient'

type AboInfoMode = 'form' | 'pending' | 'confirmed' | 'member_manual'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', core: 'Core', member: 'Member', guest: 'Guest',
}

export const AboInfoContent = memo(function AboInfoContent() {
  const qc = useQueryClient()
  const { t } = useLanguage()

  const { data: profile } = useQuery<Profile>({ queryKey: ['profile'] })
  const role = profile?.role ?? 'guest'
  const aboNumber = profile?.abo_number ?? null

  const rc = getRoleColors(role)
  const [verificationMode, setVerificationMode] = useState<'standard' | 'manual'>('standard')
  const [aboInput, setAboInput] = useState('')
  const [uplineInput, setUplineInput] = useState('')

  const { data: verRequest, isPending: isVerPending } = useQuery<VerificationRequest | null>({
    queryKey: ['verify-abo'],
    queryFn: () => apiClient('/api/profile/verify-abo'),
    enabled: role === 'guest',
  })

  const { data: uplineData } = useQuery<UplineData>({
    queryKey: ['profile-upline'],
    queryFn: () => apiClient('/api/profile/upline'),
    enabled: !!aboNumber,
    staleTime: 10 * 60 * 1000,
  })

  const submitVerification = useMutation({
    mutationFn: (params: { claimed_abo?: string; claimed_upline_abo: string; request_type: 'standard' | 'manual' }) =>
      apiClient('/api/profile/verify-abo', {
        method: 'POST',
        body: JSON.stringify(
          params.request_type === 'manual'
            ? { request_type: 'manual', claimed_upline_abo: params.claimed_upline_abo }
            : { claimed_abo: params.claimed_abo, claimed_upline_abo: params.claimed_upline_abo }
        ),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['verify-abo'] }),
  })

  const cancelVerification = useMutation({
    mutationFn: () => apiClient('/api/profile/verify-abo', { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['verify-abo'] }),
  })

  // While the verify-abo query is in flight for a guest, defer mode resolution
  // to avoid the form flashing before the pending/denied state is known.
  if (role === 'guest' && isVerPending) {
    return (
      <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-5 pr-16" style={{ color: 'var(--brand-crimson)' }}>
          {t('profile.tile.aboInfo')}
        </p>
        <div className="space-y-3 animate-pulse">
          <div className="h-4 rounded-lg w-3/4" style={{ backgroundColor: 'var(--border-default)' }} />
          <div className="h-4 rounded-lg w-1/2" style={{ backgroundColor: 'var(--border-default)' }} />
        </div>
      </div>
    )
  }

  let aboMode: AboInfoMode = 'form'
  if (aboNumber) {
    aboMode = 'confirmed'
  } else if (role !== 'guest') {
    aboMode = 'member_manual'
  } else if (verRequest && (verRequest.status === 'pending' || verRequest.status === 'denied')) {
    aboMode = 'pending'
  }

  return (
    <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-5 pr-16" style={{ color: 'var(--brand-crimson)' }}>
        {t('profile.tile.aboInfo')}
      </p>

      {aboMode === 'confirmed' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <p className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>{t('profile.access')}</p>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full self-start w-fit"
              style={{ backgroundColor: rc.bg, color: rc.font }}
            >
              {ROLE_LABELS[role]}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <p className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>{t('profile.aboHash')}</p>
            <p className="text-sm font-medium font-mono" style={{ color: 'var(--text-primary)' }}>
              {aboNumber} <span style={{ color: '#2d6a4f' }}>✓</span>
            </p>
          </div>
          <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 10 }}>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <p className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>{t('profile.upline')}</p>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {uplineData?.upline_name ?? '—'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <p className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>{t('profile.uplineHash')}</p>
              <p className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
                {uplineData?.upline_abo_number ?? '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {aboMode === 'member_manual' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <p className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>{t('profile.access')}</p>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full self-start w-fit"
              style={{ backgroundColor: rc.bg, color: rc.font }}
            >
              {ROLE_LABELS[role]}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <p className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>{t('profile.aboHash')}</p>
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>—</p>
          </div>
          <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 10 }}>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <p className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>{t('profile.upline')}</p>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {uplineData?.upline_name ?? '—'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <p className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>{t('profile.uplineHash')}</p>
              <p className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
                {uplineData?.upline_abo_number ?? '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {aboMode === 'pending' && (
        <div className="space-y-3">
          {verRequest?.status === 'denied' && (
            <div className="rounded-xl px-4 py-3 mb-2" style={{ backgroundColor: '#bc474915' }}>
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
          )}
          {verRequest?.status === 'pending' && (
            <div className="rounded-xl px-4 py-3" style={{ backgroundColor: '#f2cc8f33' }}>
              <p className="text-sm font-medium" style={{ color: '#7a5c00' }}>
                {verRequest.request_type === 'manual' ? t('profile.manualVerifPending') : t('profile.verifPending')}
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#7a5c00' }}>
                {verRequest.request_type === 'manual'
                  ? `Upline ${verRequest.claimed_upline_abo}`
                  : `ABO ${verRequest.claimed_abo} · Upline ${verRequest.claimed_upline_abo}`}
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
          )}
          {verRequest?.status === 'denied' && (
            <VerificationForm
              verificationMode={verificationMode}
              aboInput={aboInput}
              uplineInput={uplineInput}
              onModeChange={setVerificationMode}
              onAboChange={setAboInput}
              onUplineChange={setUplineInput}
              onSubmit={() => submitVerification.mutate(
                verificationMode === 'manual'
                  ? { request_type: 'manual', claimed_upline_abo: uplineInput.trim() }
                  : { request_type: 'standard', claimed_abo: aboInput.trim(), claimed_upline_abo: uplineInput.trim() }
              )}
              submitPending={submitVerification.isPending}
              submitError={submitVerification.isError ? (submitVerification.error as Error).message : null}
              t={t}
            />
          )}
        </div>
      )}

      {aboMode === 'form' && (
        <VerificationForm
          verificationMode={verificationMode}
          aboInput={aboInput}
          uplineInput={uplineInput}
          onModeChange={setVerificationMode}
          onAboChange={setAboInput}
          onUplineChange={setUplineInput}
          onSubmit={() => submitVerification.mutate(
            verificationMode === 'manual'
              ? { request_type: 'manual', claimed_upline_abo: uplineInput.trim() }
              : { request_type: 'standard', claimed_abo: aboInput.trim(), claimed_upline_abo: uplineInput.trim() }
          )}
          submitPending={submitVerification.isPending}
          submitError={submitVerification.isError ? (submitVerification.error as Error).message : null}
          t={t}
        />
      )}
    </div>
  )
})

function VerificationForm({
  verificationMode,
  aboInput,
  uplineInput,
  onModeChange,
  onAboChange,
  onUplineChange,
  onSubmit,
  submitPending,
  submitError,
  t,
}: {
  verificationMode: 'standard' | 'manual'
  aboInput: string
  uplineInput: string
  onModeChange: (m: 'standard' | 'manual') => void
  onAboChange: (v: string) => void
  onUplineChange: (v: string) => void
  onSubmit: () => void
  submitPending: boolean
  submitError: string | null
  t: (key: import('@/lib/i18n/translations').TranslationKey) => string
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        {t('profile.aboVerifDesc')}
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onModeChange('standard')}
          className="flex-1 py-2 rounded-xl text-xs font-semibold transition-colors"
          style={{
            backgroundColor: verificationMode === 'standard' ? 'var(--text-primary)' : 'transparent',
            color: verificationMode === 'standard' ? 'var(--bg-card)' : 'var(--text-secondary)',
            border: '1px solid var(--border-default)',
          }}
        >
          {t('profile.hasAboNumber')}
        </button>
        <button
          onClick={() => onModeChange('manual')}
          className="flex-1 py-2 rounded-xl text-xs font-semibold transition-colors"
          style={{
            backgroundColor: verificationMode === 'manual' ? 'var(--text-primary)' : 'transparent',
            color: verificationMode === 'manual' ? 'var(--bg-card)' : 'var(--text-secondary)',
            border: '1px solid var(--border-default)',
          }}
        >
          {t('profile.noAboYet')}
        </button>
      </div>
      {verificationMode === 'standard' && (
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
            {t('profile.yourAbo')}
          </label>
          <input
            value={aboInput}
            onChange={e => onAboChange(e.target.value)}
            placeholder="e.g. 7023040472"
            className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm font-mono"
            style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }}
          />
        </div>
      )}
      <div>
        <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
          {t('profile.sponsorAbo')}
        </label>
        <input
          value={uplineInput}
          onChange={e => onUplineChange(e.target.value)}
          placeholder="e.g. 7010970187"
          className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm font-mono"
          style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }}
        />
      </div>
      {submitError && (
        <p className="text-xs" style={{ color: 'var(--brand-crimson)' }}>{submitError}</p>
      )}
      <button
        onClick={onSubmit}
        disabled={submitPending || (verificationMode === 'standard' ? (!aboInput || !uplineInput) : !uplineInput)}
        className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
        style={{ backgroundColor: 'var(--text-primary)' }}
      >
        {submitPending ? t('profile.submitting') : t('profile.submitVerif')}
      </button>
    </div>
  )
}
