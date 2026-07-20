'use client'

import { useActionState, useState } from 'react'
import { resendGuestLink, type ResendGuestLinkState } from '@/lib/actions/guest-registration'
import { useLanguage } from '@/lib/hooks/useLanguage'

const initialState: ResendGuestLinkState = { success: true }

/**
 * Shared "didn't get the link" resend form — used on both the register page
 * (in-line, alongside the register form) and the expired-join page (as the
 * primary recovery action). Always shows the same neutral confirmation
 * regardless of whether `email` matches a real registration — see
 * resendGuestLink() in lib/actions/guest-registration.ts for the no-email-
 * enumeration contract this UI must not undermine. `submitted` (not the
 * action's return value, which is always the same shape) drives the
 * confirmation view, since the response itself must carry no signal.
 */
export function ResendLinkForm({ eventId }: { eventId: string }) {
  const [submitted, setSubmitted] = useState(false)
  const [, formAction, isPending] = useActionState(
    async (_prev: ResendGuestLinkState, formData: FormData) => {
      const email = String(formData.get('email') ?? '')
      const result = await resendGuestLink(eventId, email)
      setSubmitted(true)
      return result
    },
    initialState,
  )
  const { t } = useLanguage()

  return (
    <form action={formAction} className="mt-6 pt-6" style={{ borderTop: '1px solid var(--border-default)' }}>
      {submitted ? (
        <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
          {t('event.resend.sent')}
        </p>
      ) : (
        <>
          <p className="text-xs font-semibold tracking-widest uppercase mb-2 text-center" style={{ color: 'var(--text-secondary)' }}>
            {t('event.resend.title')}
          </p>
          <div className="flex flex-col gap-2">
            <label htmlFor={`resend-email-${eventId}`} className="sr-only">
              {t('event.resend.emailPlaceholder')}
            </label>
            <input
              type="email"
              name="email"
              id={`resend-email-${eventId}`}
              required
              placeholder={t('event.resend.emailPlaceholder')}
              className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-default)',
                color: 'var(--text-primary)',
              }}
            />
            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-60 transition-opacity"
              style={{
                backgroundColor: 'var(--bg-global)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)',
                minHeight: 44,
              }}
            >
              {isPending ? t('event.resend.sending') : t('event.resend.button')}
            </button>
          </div>
        </>
      )}
    </form>
  )
}
