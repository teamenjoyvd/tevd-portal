'use client'

import { memo, useState } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { getRoleColors } from '@/lib/role-colors'

type VerificationRequest = {
  id: string
  claimed_abo: string | null
  claimed_upline_abo: string
  status: 'pending' | 'approved' | 'denied'
  admin_note: string | null
  created_at: string
  request_type: string
}

type UplineData = {
  upline_name: string | null
  upline_abo_number: string | null
}

type AboInfoMode = 'form' | 'pending' | 'confirmed' | 'member_manual'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', core: 'Core', member: 'Member', guest: 'Guest',
}

export const AboInfoContent = memo(function AboInfoContent({
  mode,
  role,
  aboNumber,
  uplineData,
  verRequest,
  onSubmitVerification,
  onCancelVerification,
  submitPending,
  cancelPending,
  submitError,
}: {
  mode: AboInfoMode
  role: string
  aboNumber: string | null
  uplineData: UplineData | undefined
  verRequest: VerificationRequest | null | undefined
  onSubmitVerification: (params: { claimed_abo?: string; claimed_upline_abo: string; request_type: 'standard' | 'manual' }) => void
  onCancelVerification: () => void
  submitPending: boolean
  cancelPending: boolean
  submitError: string | null
}) {
  const { t } = useLanguage()
  const rc = getRoleColors(role)
  const [verificationMode, setVerificationMode] = useState<'standard' | 'manual'>('standard')
  const [aboInput, setAboInput] = useState('')
  const [uplineInput, setUplineInput] = useState('')

  return (
    <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-5 pr-16" style={{ color: 'var(--brand-crimson)' }}>
        {t('profile.tile.aboInfo')}
      </p>

      {mode === 'confirmed' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <p className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>Access</p>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full self-start w-fit"
              style={{ backgroundColor: rc.bg, color: rc.font }}
            >
              {ROLE_LABELS[role]}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <p className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>ABO #</p>
            <p className="text-sm font-medium font-mono" style={{ color: 'var(--text-primary)' }}>
              {aboNumber} <span style={{ color: '#2d6a4f' }}>✓</span>
            </p>
          </div>
          <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 10 }}>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <p className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>Upline</p>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {uplineData?.upline_name ?? '—'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <p className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>Upline #</p>
              <p className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
                {uplineData?.upline_abo_number ?? '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {mode === 'member_manual' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <p className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>Access</p>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full self-start w-fit"
              style={{ backgroundColor: rc.bg, color: rc.font }}
            >
              {ROLE_LABELS[role]}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <p className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>ABO #</p>
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>—</p>
          </div>
          <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 10 }}>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <p className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>Upline</p>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {uplineData?.upline_name ?? '—'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <p className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>Upline #</p>
              <p className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
                {uplineData?.upline_abo_number ?? '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {mode === 'pending' && (
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
                {verRequest.request_type === 'manual' ? 'Manual verification pending' : t('profile.verifPending')}
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#7a5c00' }}>
                {verRequest.request_type === 'manual'
                  ? `Upline ${verRequest.claimed_upline_abo}`
                  : `ABO ${verRequest.claimed_abo} · Upline ${verRequest.claimed_upline_abo}`}
              </p>
              <button
                onClick={onCancelVerification}
                disabled={cancelPending}
                className="text-xs mt-2 font-medium hover:underline disabled:opacity-50"
                style={{ color: 'var(--brand-crimson)' }}
              >
                {t('profile.cancelRequest')}
              </button>
            </div>
          )}
          {/* denied → fall through to show form below */}
          {verRequest?.status === 'denied' && (
            <VerificationForm
              verificationMode={verificationMode}
              aboInput={aboInput}
              uplineInput={uplineInput}
              onModeChange={setVerificationMode}
              onAboChange={setAboInput}
              onUplineChange={setUplineInput}
              onSubmit={() => onSubmitVerification(
                verificationMode === 'manual'
                  ? { request_type: 'manual', claimed_upline_abo: uplineInput.trim() }
                  : { request_type: 'standard', claimed_abo: aboInput.trim(), claimed_upline_abo: uplineInput.trim() }
              )}
              submitPending={submitPending}
              submitError={submitError}
              t={t}
            />
          )}
        </div>
      )}

      {mode === 'form' && (
        <VerificationForm
          verificationMode={verificationMode}
          aboInput={aboInput}
          uplineInput={uplineInput}
          onModeChange={setVerificationMode}
          onAboChange={setAboInput}
          onUplineChange={setUplineInput}
          onSubmit={() => onSubmitVerification(
            verificationMode === 'manual'
              ? { request_type: 'manual', claimed_upline_abo: uplineInput.trim() }
              : { request_type: 'standard', claimed_abo: aboInput.trim(), claimed_upline_abo: uplineInput.trim() }
          )}
          submitPending={submitPending}
          submitError={submitError}
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
          I have an ABO number
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
          I don&apos;t have one yet
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
