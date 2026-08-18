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
import { Check, Video } from 'lucide-react'
import type { TranslationKey } from '@/lib/i18n'
import AddToCalendarMenu from '@/components/AddToCalendarMenu'

type Props = {
  isRegistered: boolean
  isEnded: boolean
  isPending: boolean
  onAttend: () => void
  onCancelAttend: () => void
  t: (key: TranslationKey) => string
  /** Event data for the attending-state CTA row (2608-DEV-707). */
  eventId: string
  title: string
  startTime: string
  endTime: string
  meetingUrl: string | null
}

export default function AttendSection({
  isRegistered, isEnded, isPending, onAttend, onCancelAttend, t,
  eventId, title, startTime, endTime, meetingUrl,
}: Props) {
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
      <div className="space-y-2.5">
      <div className="flex items-center gap-3">
        <span
          className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-control"
          style={{ backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success-fg)' }}
        >
          <Check size={10} />
          {t('cal.attending')}
        </span>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              disabled={isPending}
              className="text-xs font-medium hover:opacity-70 transition-opacity disabled:opacity-40"
              style={{ color: 'var(--status-alert-fg)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
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

        {/* Attending-state CTA row (2608-DEV-707). The "Join meeting" link goes
            to /events/[id]/join, which STAMPS attendance — deliberately not the
            same thing as the raw meeting_url shown above it, which just opens
            the call. The caption is what tells the two apart. */}
        <div className="flex items-center gap-4 flex-wrap">
          <a
            href={`/events/${eventId}/join`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col"
            style={{ color: 'var(--link)' }}
          >
            <span className="flex items-center gap-1.5 text-xs font-semibold hover:opacity-70 transition-opacity">
              <Video size={12} />
              {t('event.join.joinMeeting')}
            </span>
            <span className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>
              {t('cal.joinRecordsAttendance')}
            </span>
          </a>
          {startTime !== '' && endTime !== '' && (
            <AddToCalendarMenu
              title={title}
              startTime={startTime}
              endTime={endTime}
              meetingUrl={meetingUrl}
            />
          )}
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={onAttend}
      disabled={isPending}
      className="flex items-center gap-1.5 text-xs font-semibold hover:opacity-70 transition-opacity disabled:opacity-40"
      style={{ color: 'var(--link)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
    >
      {isPending ? '…' : t('cal.attend')}
    </button>
  )
}
