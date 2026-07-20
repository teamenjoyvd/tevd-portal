'use client'

import { useActionState, useRef } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cancelGuestRegistration, type CancelGuestRegistrationState } from '@/lib/actions/guest-registration'
import { useLanguage } from '@/lib/hooks/useLanguage'

const initialState: CancelGuestRegistrationState = { success: false }

export function CancelActions({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(cancelGuestRegistration, initialState)
  const { t } = useLanguage()
  const formRef = useRef<HTMLFormElement>(null)

  if (state.success) {
    return (
      <p className="mt-6 text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
        {t('event.join.cancelSuccess')}
      </p>
    )
  }

  return (
    <form ref={formRef} action={formAction} className="mt-6 text-center">
      <input type="hidden" name="token" value={token} />
      {state.error && (
        <p className="text-sm mb-2" style={{ color: '#bc4749' }}>{t('event.join.cancelError')}</p>
      )}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            className="text-xs font-medium underline hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {t('event.join.cantAttend')}
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('event.join.cancelConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('event.join.cancelConfirmDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">{t('event.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              disabled={isPending}
              onClick={() => formRef.current?.requestSubmit()}
            >
              {t('event.join.cantAttend')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}
