'use client'

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
import { Check } from 'lucide-react'
import type { TranslationKey } from '@/lib/i18n'

type Props = {
  isRegistered: boolean
  isEnded: boolean
  isPending: boolean
  onAttend: () => void
  onCancelAttend: () => void
  t: (key: TranslationKey) => string
}

export default function AttendSection({ isRegistered, isEnded, isPending, onAttend, onCancelAttend, t }: Props) {
  if (isEnded) {
    return (
      <button
        disabled
        className="flex items-center gap-1.5 text-xs font-medium opacity-40 cursor-not-allowed"
        style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', padding: 0 }}
      >
        {t('cal.attendClosed')}
      </button>
    )
  }

  if (isRegistered) {
    return (
      <div className="flex items-center gap-3">
        <span
          className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: 'var(--status-success-bg, rgba(129,178,154,0.18))', color: 'var(--status-success-fg, #2d6a4f)' }}
        >
          <Check size={10} />
          {t('cal.attending')}
        </span>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              disabled={isPending}
              className="text-xs font-medium hover:opacity-70 transition-opacity disabled:opacity-40"
              style={{ color: 'var(--brand-crimson)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              {t('cal.cantAttend')}
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('cal.cancelAttendTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('cal.cancelAttendDesc')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('event.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={onCancelAttend}>{t('cal.cantAttend')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  return (
    <button
      onClick={onAttend}
      disabled={isPending}
      className="flex items-center gap-1.5 text-xs font-semibold hover:opacity-70 transition-opacity disabled:opacity-40"
      style={{ color: 'var(--brand-teal)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
    >
      {isPending ? '…' : t('cal.attend')}
    </button>
  )
}
