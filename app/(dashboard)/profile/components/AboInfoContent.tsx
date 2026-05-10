'use client'

import { memo, useState } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { getRoleColors } from '@/lib/role-colors'
import { type Profile, type SpouseLinkRequest } from '../types'
import { apiClient } from '@/lib/apiClient'

type AboInfoMode = 'form' | 'pending' | 'confirmed' | 'member_manual'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', core: 'Core', member: 'Member', guest: 'Guest',
}

/** Maps structured error_code values from /api/profile/verify-abo to i18n keys. */
function resolveErrorMessage(
  error: string | null,
  error_code: string | undefined,
  t: (key: import('@/lib/i18n/translations').TranslationKey) => string
): string | null {
  if (!error) return null
  switch (error_code) {
    case 'abo_not_in_los':     return t('profile.error.aboNotInLos')
    case 'upline_mismatch':    return t('profile.error.uplineMismatch')
    case 'abo_already_claimed': return t('profile.error.aboAlreadyClaimed')
    case 'upline_not_in_los':  return t('profile.error.uplineNotInLos')
    case 'abo_has_primary':    return t('profile.error.aboHasPrimary')
    default:                   return error
  }
}

export const AboInfoContent = memo(function AboInfoContent() {
  const qc = useQueryClient()
  const { t } = useLanguage()

  const { data: profile, isPending: profileIsPending } = useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: () => apiClient('/api/profile'),
  })

  const role = profile?.role ?? 'guest'
  const aboNumber = profile?.abo_number ?? null
  const uplineData = profile?.upline ?? null
  const verRequest = profile?.verRequest ?? null
  const spouse = profile?.spouse ?? null
  const pendingSpouseLinkCount = profile?.pendingSpouseLinkCount ?? 0

  const rc = getRoleColors(role)
  const [verificationMode, setVerificationMode] = useState<'standard' | 'manual'>('standard')
  const [aboInput, setAboInput] = useState('')
  const [uplineInput, setUplineInput] = useState('')

  // Spouse link flow state
  const [showSpouseLink, setShowSpouseLink] = useState(false)
  const [spouseAboInput, setSpouseAboInput] = useState('')

  const { data: spouseLinkRequest } = useQuery<SpouseLinkRequest | null>({
    queryKey: ['spouseLinkRequest'],
    queryFn: () => apiClient('/api/profile/spouse-link'),
    // Guard on !!profile to avoid firing before profile loads — role defaults to
    // 'guest' so without this the query would execute for every user on mount.
    enabled: !!profile && role === 'guest' && !profile.primary_profile_id,
  })

  const submitVerification = useMutation({
    mutationFn: async (params: { claimed_abo?: string; claimed_upline_abo: string; request_type: 'standard' | 'manual' }) => {
      // Intentionally using raw fetch instead of apiClient because apiClient
      // discards the custom 'error_code' needed for i18n translation mapping.
      const res = await fetch('/api/profile/verify-abo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          params.request_type === 'manual'
            ? { request_type: 'manual', claimed_upline_abo: params.claimed_upline_abo }
            : { claimed_abo: params.claimed_abo, claimed_upline_abo: params.claimed_upline_abo }
        ),
      })
      const data = await res.json()
      if (!res.ok) {
        const err = new Error(data.error ?? 'Submission failed') as Error & { error_code?: string }
        err.error_code = data.error_code
        throw err
      }
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  })

  const cancelVerification = useMutation({
    mutationFn: () => apiClient('/api/profile/verify-abo', { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  })

  const submitSpouseLink = useMutation({
    mutationFn: async (claimed_primary_abo: string) => {
      const res = await fetch('/api/profile/spouse-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimed_primary_abo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Request failed')
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['spouseLinkRequest'] })
      setShowSpouseLink(false)
      setSpouseAboInput('')
    },
  })

  const cancelSpouseLink = useMutation({
    mutationFn: () => apiClient('/api/profile/spouse-link', { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['spouseLinkRequest'] }),
  })

  if (role === 'guest' && profileIsPending) {
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

  // Extract error_code from mutation error (attached by mutationFn)
  const mutationError = submitVerification.isError ? submitVerification.error as Error & { error_code?: string } : null
  const submitErrorMessage = resolveErrorMessage(
    mutationError?.message ?? null,
    mutationError?.error_code,
    t
  )

  // When verify-abo returns abo_has_primary, surface the spouse link flow inline
  const showSpouseLinkCta = mutationError?.error_code === 'abo_has_primary'

  // Stale-LOS hint for denied requests (admin_note signals stale LOS)
  const showStaleHint =
    verRequest?.status === 'denied' &&
    verRequest?.admin_note != null &&
    /stale|old|outdated|re.import/i.test(verRequest.admin_note)

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
            {spouse && (
              <div className="grid grid-cols-2 gap-3 mt-2">
                <p className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>{t('profile.coOwner')}</p>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {spouse.first_name} {spouse.last_name}
                </p>
              </div>
            )}
          </div>
          {/* Primary member: pending inbound spouse link request notification */}
          {pendingSpouseLinkCount > 0 && (
            <Link
              href="/profile/spouse-link"
              className="flex items-center gap-2 rounded-xl px-4 py-3 mt-1"
              style={{ backgroundColor: '#f2cc8f33', textDecoration: 'none' }}
            >
              <span className="text-sm font-medium" style={{ color: '#7a5c00' }}>
                {pendingSpouseLinkCount === 1
                  ? 'Someone has requested to link as your spouse account'
                  : `${pendingSpouseLinkCount} spouse link requests pending`}
              </span>
              <span className="ml-auto text-xs font-semibold" style={{ color: '#7a5c00' }}>Review →</span>
            </Link>
          )}
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
          {/* Primary member: pending inbound spouse link request notification */}
          {pendingSpouseLinkCount > 0 && (
            <Link
              href="/profile/spouse-link"
              className="flex items-center gap-2 rounded-xl px-4 py-3"
              style={{ backgroundColor: '#f2cc8f33', textDecoration: 'none' }}
            >
              <span className="text-sm font-medium" style={{ color: '#7a5c00' }}>
                {pendingSpouseLinkCount === 1
                  ? 'Someone has requested to link as your spouse account'
                  : `${pendingSpouseLinkCount} spouse link requests pending`}
              </span>
              <span className="ml-auto text-xs font-semibold" style={{ color: '#7a5c00' }}>Review →</span>
            </Link>
          )}
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
              {showStaleHint && (
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {t('profile.error.losStaleNote')}
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
              submitError={submitErrorMessage}
              showSpouseLinkCta={showSpouseLinkCta}
              onSpouseLinkCtaClick={() => setShowSpouseLink(true)}
              t={t}
            />
          )}
        </div>
      )}

      {aboMode === 'form' && (
        <>
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
            submitError={submitErrorMessage}
            showSpouseLinkCta={showSpouseLinkCta}
            onSpouseLinkCtaClick={() => setShowSpouseLink(true)}
            t={t}
          />
          {/* Spouse link flow — shown when abo_has_primary error or user taps the entry point */}
          {(showSpouseLink || spouseLinkRequest) && (
            <SpouseLinkSection
              spouseLinkRequest={spouseLinkRequest ?? null}
              spouseAboInput={spouseAboInput}
              onAboChange={setSpouseAboInput}
              onSubmit={() => submitSpouseLink.mutate(spouseAboInput.trim())}
              onCancel={() => cancelSpouseLink.mutate()}
              submitPending={submitSpouseLink.isPending}
              submitError={submitSpouseLink.isError ? (submitSpouseLink.error as Error).message : null}
              cancelPending={cancelSpouseLink.isPending}
              t={t}
            />
          )}
          {/* Entry point for guests with no active flow and no abo_has_primary error */}
          {!showSpouseLink && !spouseLinkRequest && !showSpouseLinkCta && (
            <button
              onClick={() => setShowSpouseLink(true)}
              className="mt-4 text-xs font-medium hover:underline"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('profile.spouseLinkEntryPoint')}
            </button>
          )}
        </>
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
  showSpouseLinkCta,
  onSpouseLinkCtaClick,
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
  showSpouseLinkCta: boolean
  onSpouseLinkCtaClick: () => void
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
      {showSpouseLinkCta && (
        <button
          onClick={onSpouseLinkCtaClick}
          className="w-full py-2 rounded-xl text-xs font-semibold border transition-colors hover:opacity-80"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
        >
          {t('profile.spouseLinkSubmit')}
        </button>
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

function SpouseLinkSection({
  spouseLinkRequest,
  spouseAboInput,
  onAboChange,
  onSubmit,
  onCancel,
  submitPending,
  submitError,
  cancelPending,
  t,
}: {
  spouseLinkRequest: SpouseLinkRequest | null
  spouseAboInput: string
  onAboChange: (v: string) => void
  onSubmit: () => void
  onCancel: () => void
  submitPending: boolean
  submitError: string | null
  cancelPending: boolean
  t: (key: import('@/lib/i18n/translations').TranslationKey) => string
}) {
  if (spouseLinkRequest?.status === 'pending') {
    return (
      <div className="mt-4 rounded-xl px-4 py-3" style={{ backgroundColor: '#f2cc8f33' }}>
        <p className="text-sm font-medium" style={{ color: '#7a5c00' }}>
          {t('profile.spouseLinkPending')}
        </p>
        <button
          onClick={onCancel}
          disabled={cancelPending}
          className="text-xs mt-2 font-medium hover:underline disabled:opacity-50"
          style={{ color: 'var(--brand-crimson)' }}
        >
          {t('profile.spouseLinkCancelRequest')}
        </button>
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-3" style={{ borderTop: '1px solid var(--border-default)', paddingTop: 16 }}>
      {spouseLinkRequest?.status === 'denied' && (
        <div className="rounded-xl px-4 py-3" style={{ backgroundColor: '#bc474915' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--brand-crimson)' }}>
            {t('profile.spouseLinkDenied')}
          </p>
          {spouseLinkRequest.admin_note && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--brand-crimson)' }}>
              {spouseLinkRequest.admin_note}
            </p>
          )}
        </div>
      )}
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        {t('profile.spouseLinkDesc')}
      </p>
      <div>
        <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
          {t('profile.spouseLinkAboLabel')}
        </label>
        <input
          value={spouseAboInput}
          onChange={e => onAboChange(e.target.value)}
          placeholder="e.g. 7023040472"
          className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm font-mono"
          style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }}
        />
      </div>
      {submitError && (
        <p className="text-xs" style={{ color: 'var(--brand-crimson)' }}>{submitError}</p>
      )}
      <button
        onClick={onSubmit}
        disabled={submitPending || !spouseAboInput}
        className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
        style={{ backgroundColor: 'var(--text-primary)' }}
      >
        {submitPending ? t('profile.submitting') : (spouseLinkRequest?.status === 'denied' ? t('profile.spouseLinkResubmit') : t('profile.spouseLinkSubmit'))}
      </button>
    </div>
  )
}
