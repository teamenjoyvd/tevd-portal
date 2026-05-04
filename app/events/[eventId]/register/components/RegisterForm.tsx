'use client'

import { useActionState } from 'react'
import { registerGuest } from '@/lib/actions/guest-registration'
import type { RegisterGuestState } from '@/lib/actions/guest-registration'
import { useLanguage } from '@/lib/hooks/useLanguage'

const initialState: RegisterGuestState = { success: false }

export function RegisterForm({
  eventId,
  eventTitle,
  shareToken,
}: {
  eventId: string
  eventTitle: string
  shareToken?: string
}) {
  const [state, formAction, isPending] = useActionState(registerGuest, initialState)
  const { t } = useLanguage()

  if (state.success) {
    return (
      <div
        className="rounded-2xl border px-6 py-8 text-center"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: 'rgba(26,60,46,0.12)' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a3c2e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <p className="font-semibold text-base mb-1" style={{ color: 'var(--text-primary)' }}>
          {t('event.register.checkInbox')}
        </p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {t('event.register.sentLink')}
        </p>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="eventId" value={eventId} />
      {shareToken && <input type="hidden" name="shareToken" value={shareToken} />}

      <div>
        <label
          htmlFor="name"
          className="block text-xs font-semibold tracking-widest uppercase mb-1.5"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('event.register.fullName')}
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          minLength={2}
          maxLength={100}
          autoComplete="name"
          placeholder={t('event.register.yourName')}
          className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-default)',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      <div>
        <label
          htmlFor="email"
          className="block text-xs font-semibold tracking-widest uppercase mb-1.5"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('event.register.emailAddress')}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={t('event.register.emailPlaceholder')}
          className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-default)',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      {state.error && (
        <p className="text-sm" style={{ color: '#bc4749' }}>
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
        style={{ backgroundColor: '#1a3c2e', minHeight: 44 }}
      >
        {isPending ? t('event.register.sendingLink') : t('event.register.getAccessLink')}
      </button>

      <p className="text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
        {t('event.register.emailDesc')} <strong>{eventTitle}</strong>.
        {t('event.register.noAccountDesc')}
      </p>
    </form>
  )
}
