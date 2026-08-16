'use client'

import { UseMutationResult } from '@tanstack/react-query'
import { X, Check, Lock } from 'lucide-react'
import Link from 'next/link'
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
import type { TranslationKey } from '@/lib/i18n'
import { ROLE_CUTOFF_MS, minutesUntilRoleCutoff } from '@/lib/events/role-cutoff'
import { useMinuteTick } from '@/lib/hooks/useMinuteTick'
import { PendingPopover } from './PendingPopover'
import { SLOT_STATUS_STYLES, REQUEST_STATUS_STYLES } from './styles'
import type { EventDetail, RoleSlot } from './types'

const CUTOFF_MINUTES = ROLE_CUTOFF_MS / 60_000

type Props = {
  event: EventDetail
  isLoading: boolean
  canRequestRole: boolean
  isClosed: boolean
  profileNameMissing: boolean
  requestMutation: UseMutationResult<unknown, unknown, string>
  cancelMutation: UseMutationResult<unknown, unknown, void>
  t: (key: TranslationKey) => string
}

export default function MemberActions({
  event, isLoading, canRequestRole, isClosed, profileNameMissing, requestMutation, cancelMutation, t,
}: Props) {
  // Hooks run before the early return — a countdown that only ticks while the
  // popup is open AND inside the final hour, so no interval runs for the common
  // case of an event days away.
  const startTime = event?.start_time ?? ''
  const minutesLeft = startTime !== '' ? minutesUntilRoleCutoff(startTime) : Number.POSITIVE_INFINITY
  // Derived here, not just taken from the prop: the prop is computed once in
  // EventPopup, and the tick below re-renders THIS component only. Without the
  // local `minutesLeft <= 0` the popup would sit on the generic hint at the
  // exact moment the window closed, with the buttons still live.
  const closed = isClosed || minutesLeft <= 0
  const inCountdown = !closed && minutesLeft <= CUTOFF_MINUTES
  useMinuteTick(inCountdown)

  if (isLoading || !event) return null

  const roleSlots = event.role_slots ?? []
  const isMutating = requestMutation.isPending || cancelMutation.isPending

  // Only a PENDING or APPROVED request occupies the member (2608-DEV-749).
  // A denied row no longer blocks them — that is what lets a member the admin
  // passed over claim a slot that has since reopened. /api/events/[id] never
  // sends a cancelled row as caller_request at all.
  const hasActiveRequest = roleSlots.some(
    s => s.caller_request !== null
      && (s.caller_request.status === 'pending' || s.caller_request.status === 'approved'),
  )
  const showNameGate = canRequestRole && profileNameMissing && !hasActiveRequest

  const cutoffLine = closed
    ? t('event.cutoff.closed')
    : inCountdown
      ? t('event.cutoff.countdown').replace('{{minutes}}', String(minutesLeft))
      : t('event.cutoff.hint')

  return (
    <div className="px-4 py-3 border-b border-black/5">
      <p className="text-[10px] font-semibold tracking-widest uppercase mb-1 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
        {t('event.roles')}
        {closed && <Lock size={10} />}
      </p>

      {/* Cutoff copy: the window was silent before this ticket — a closed slot
          rendered as a bare lock icon with no explanation. */}
      <p className="text-[10px] mb-3" style={{ color: 'var(--text-secondary)' }}>
        {cutoffLine}
      </p>

      {/* Existing request read-only badge (shown above buttons) */}
      {canRequestRole && (() => {
        const mySlot = roleSlots.find(s => s.caller_request !== null)
        const myReq  = mySlot?.caller_request ?? null
        return myReq ? (
          <div className="rounded-container p-2.5 mb-3" style={{ backgroundColor: REQUEST_STATUS_STYLES[myReq.status].bg }}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-medium mb-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {t('event.slot.yourRequest')}
                </p>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{myReq.role_label}</p>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-xl"
                style={{ backgroundColor: 'var(--bg-card-raised)', color: REQUEST_STATUS_STYLES[myReq.status].color }}>
                {myReq.status}
              </span>
            </div>
          </div>
        ) : null
      })()}

      {/* T1: profile name gate callout */}
      {showNameGate && (
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {t('event.nameRequiredToRequest')}{' '}
          <Link href="/profile" style={{ color: 'var(--brand-teal)' }}>
            {t('event.goToProfile')}
          </Link>
        </p>
      )}

      {/* T5: slot buttons — always rendered, disabled when closed.
          T1: hidden when name gate is active (no existing request) */}
      {canRequestRole && !showNameGate && (
        <div className="flex gap-2 flex-wrap">
          {roleSlots.map((slot: RoleSlot) => {
            const myReq     = slot.caller_request
            const isActive  = myReq !== null
            const isFilled  = slot.status === 'filled'
            const activeStyle = isActive ? REQUEST_STATUS_STYLES[myReq.status] : null
            const slotStyle   = isFilled ? SLOT_STATUS_STYLES.filled : SLOT_STATUS_STYLES[slot.status]

            const isPendingMine  = isActive && myReq.status === 'pending'
            const isApprovedMine = isActive && myReq.status === 'approved'
            const disabledCancel  = isMutating || closed
            const disabledRequest = isMutating || isFilled || hasActiveRequest || closed

            const occupantName = isFilled && slot.assigned_profile
              ? [slot.assigned_profile.first_name, slot.assigned_profile.last_name].filter(Boolean).join(' ') || null
              : null

            const buttonClass = 'flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-bold tracking-wider uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-95 active:scale-[0.97]'
            const buttonStyle = {
              backgroundColor: activeStyle ? activeStyle.bg : slotStyle.bg,
              color: activeStyle ? activeStyle.color : slotStyle.color,
              border: activeStyle ? `1px solid ${activeStyle.color}33` : '1px solid transparent',
            }
            const buttonBody = (
              <>
                {slot.role_label}
                {/* Both of the caller's own live states now offer a way out —
                    the approved case used to render an inert <Check/>. */}
                {(isPendingMine || isApprovedMine) && <X size={10} className="opacity-60" />}
                {isFilled && !isActive && <Check size={10} className="opacity-40" />}
                {closed && !isActive && <Lock size={10} className="opacity-40" />}
              </>
            )

            return (
              <div key={slot.role_label} className="flex-1 flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-1">
                  {isApprovedMine ? (
                    // Giving up a role you already hold is destructive and
                    // reopens the slot for everyone, so it goes behind a
                    // confirm. Pending-cancel stays a direct click — nothing is
                    // lost by re-requesting.
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button disabled={disabledCancel} className={buttonClass} style={buttonStyle}>
                          {buttonBody}
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('event.withdrawRoleTitle')}</AlertDialogTitle>
                          <AlertDialogDescription>{t('event.withdrawRoleDesc')}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('event.cancel')}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => cancelMutation.mutate()}>
                            {t('event.withdrawRoleConfirm')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <button
                      onClick={() => {
                        if (closed) return
                        if (isPendingMine) cancelMutation.mutate()
                        else if (!hasActiveRequest && !isFilled) requestMutation.mutate(slot.role_label)
                      }}
                      disabled={isPendingMine ? disabledCancel : disabledRequest}
                      className={buttonClass}
                      style={buttonStyle}
                    >
                      {buttonBody}
                    </button>
                  )}
                  {slot.status === 'contested' && slot.pending_profiles.length > 0 && (
                    <PendingPopover profiles={slot.pending_profiles} color={slotStyle.color} />
                  )}
                </div>
                {occupantName && (
                  <p className="text-[10px] text-center" style={{ color: 'var(--text-secondary)' }}>
                    {occupantName}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
