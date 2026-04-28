'use client'

import { useState } from 'react'
import type { GuestProfile } from './VerificationsTab'
import { useLanguage } from '@/lib/hooks/useLanguage'

type Props = {
  candidates: GuestProfile[]
  onSubmit: (args: { profile_id: string; upline_abo_number: string }) => Promise<void>
  isPending: boolean
}

export function DirectVerifyForm({ candidates, onSubmit, isPending }: Props) {
  const { t } = useLanguage()
  const [profileId, setProfileId] = useState('')
  const [upline, setUpline] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit() {
    setError(null)
    try {
      await onSubmit({ profile_id: profileId, upline_abo_number: upline.trim() })
      setProfileId('')
      setUpline('')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: 'var(--text-secondary)' }}>
        {t('admin.approval.verify.directTitle')}
      </p>
      <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
        {t('admin.approval.verify.directDesc')}
      </p>
      <div className="rounded-xl border p-5 space-y-4" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
            {t('admin.approval.verify.lbl.guest')}
          </label>
          <select
            value={profileId}
            onChange={e => setProfileId(e.target.value)}
            className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
            style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
          >
            <option value="">{t('admin.approval.verify.opt.selectGuest')}</option>
            {candidates.map(g => (
              <option key={g.id} value={g.id}>
                {g.first_name} {g.last_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
            {t('admin.approval.verify.lbl.uplineAbo')}
          </label>
          <input
            value={upline}
            onChange={e => setUpline(e.target.value)}
            placeholder={t('admin.approval.verify.placeholder.upline')}
            className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm font-mono"
            style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
          />
        </div>
        {error && (
          <p className="text-xs" style={{ color: 'var(--brand-crimson)' }}>{error}</p>
        )}
        <button
          onClick={handleSubmit}
          disabled={isPending || !profileId || !upline.trim()}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--brand-forest)' }}
        >
          {isPending
            ? t('admin.approval.verify.btn.verifying')
            : success
              ? t('admin.approval.verify.btn.verified')
              : t('admin.approval.verify.btn.verifyMember')}
        </button>
        {candidates.length === 0 && (
          <p className="text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
            {t('admin.approval.verify.noGuests')}
          </p>
        )}
      </div>
    </div>
  )
}
