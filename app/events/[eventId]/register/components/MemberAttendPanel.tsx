'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Video } from 'lucide-react'
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
import AddToCalendarMenu from '@/components/AddToCalendarMenu'
import { apiClient, ApiError } from '@/lib/apiClient'
import { useLanguage } from '@/lib/hooks/useLanguage'

/**
 * Recognised-member panel on the public share/register page (2608-DEV-708).
 *
 * Replaces <RegisterForm> for a signed-in non-guest: no name/email inputs, no
 * honeypot, no magic link — the member already has a portal identity, and the
 * attend route resolves it server-side from the Clerk session.
 *
 * `isAttending` and `meetingUrl` are SERVER props, never client state: a
 * successful call ends in router.refresh(), which re-runs the page and only
 * then puts meeting_url in the payload. That is what keeps D3 honest — the
 * link is never shipped to someone without an active registration.
 *
 * No server action here, deliberately: POST/DELETE /api/events/[id]/attend
 * already owns this logic (identity via withProfile, 403 for role 'guest',
 * `{ share }` -> attendEvent). A server action would be a second front door
 * onto the same helper. The cost is useActionState's no-JS submit; the
 * logged-out guest form keeps its server action untouched.
 */

type Props = {
  eventId: string
  /** Present only while an active registration exists — server-gated (D3). */
  meetingUrl: string | null
  eventTitle: string
  startTime: string
  endTime: string
  memberName: string
  /** Inviter's name when `?share=` resolves to a live link, else null. */
  sharerName: string | null
  shareToken?: string
  isAttending: boolean
}

export function MemberAttendPanel({
  eventId,
  meetingUrl,
  eventTitle,
  startTime,
  endTime,
  memberName,
  sharerName,
  shareToken,
  isAttending,
}: Props) {
  const router = useRouter()
  const { t } = useLanguage()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The route reports capacity and event-ended as plain 400s; map those two to
  // the copy this page already uses for them, and everything else — network
  // failure, 5xx, an unrecognised message — to the generic attend error.
  function messageFor(err: unknown): string {
    const raw = err instanceof ApiError ? err.message : ''
    if (raw.includes('capacity')) return t('event.register.full')
    if (raw.includes('already ended')) return t('event.register.eventEnded')
    return t('event.register.attendError')
  }

  async function run(request: () => Promise<unknown>) {
    if (isPending) return
    setIsPending(true)
    setError(null)
    try {
      await request()
      // Success renders from the refreshed server pass, not from local state.
      router.refresh()
    } catch (err) {
      setError(messageFor(err))
    } finally {
      setIsPending(false)
    }
  }

  const attend = () =>
    run(() =>
      apiClient(`/api/events/${eventId}/attend`, {
        method: 'POST',
        body: JSON.stringify(shareToken === undefined ? {} : { share: shareToken }),
      }),
    )

  const cancelAttend = () =>
    run(() => apiClient(`/api/events/${eventId}/attend`, { method: 'DELETE' }))

  return (
    <div className="space-y-4">
      <div>
        {/* `first_name`/`last_name` are both nullable, so page.tsx can hand us an
            empty string. "Signed in as " with nothing after it is worse than no
            identity line at all — the panel itself already proves recognition. */}
        {memberName !== '' && (
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('event.register.signedInAs').replace('{name}', memberName)}
          </p>
        )}
        {sharerName !== null && (
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {t('event.register.invitedBy').replace('{name}', sharerName)}
          </p>
        )}
      </div>

      {isAttending ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: 'var(--status-success-bg, rgba(129,178,154,0.18))',
                color: 'var(--status-success-fg, #2d6a4f)',
              }}
            >
              <Check size={10} />
              {t('event.register.attendingAlready')}
            </span>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  disabled={isPending}
                  className="text-xs font-medium hover:opacity-70 transition-opacity disabled:opacity-40"
                  style={{ color: 'var(--brand-crimson, #bc4749)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
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
                  <AlertDialogAction onClick={cancelAttend}>{t('cal.cantAttend')}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {meetingUrl !== null && meetingUrl !== '' && (
            <a
              href={meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-full rounded-xl py-3.5 text-sm font-semibold text-white hover:opacity-80 transition-opacity"
              style={{ backgroundColor: '#1a3c2e', minHeight: 44 }}
            >
              {t('event.join.joinMeeting')}
            </a>
          )}

          {/* Mirrors AttendSection.tsx:87-102. The /join link STAMPS attendance,
              which is not the same thing as the raw meeting_url above it — the
              caption is what tells the two apart. Deliberately a link and not a
              redirect on success: D4 reserves that stamp for click-through. */}
          <div className="flex items-center gap-4 flex-wrap">
            <a
              href={`/events/${eventId}/join`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col"
              style={{ color: 'var(--brand-teal, #1a3c2e)' }}
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
                title={eventTitle}
                startTime={startTime}
                endTime={endTime}
                meetingUrl={meetingUrl}
              />
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={attend}
          disabled={isPending}
          aria-busy={isPending}
          className="w-full rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
          style={{ backgroundColor: '#1a3c2e', minHeight: 44 }}
        >
          {/* Label kept while pending: swapping it for '…' takes the button's
              accessible name away mid-request. disabled + disabled:opacity-60
              already carry the visual cue, aria-busy carries it to AT. */}
          {t('event.register.attendOneTap')}
        </button>
      )}

      {error !== null && (
        <p className="text-sm" style={{ color: '#bc4749' }}>
          {error}
        </p>
      )}
    </div>
  )
}
