'use client'

import { UseMutationResult } from '@tanstack/react-query'
import { X, Check, Lock } from 'lucide-react'
import Link from 'next/link'
import type { TranslationKey } from '@/lib/i18n'
import { PendingPopover } from './PendingPopover'
import { SLOT_STATUS_STYLES, REQUEST_STATUS_STYLES } from './styles'
import type { EventDetail, RoleSlot } from './types'

type Props = {
  event: EventDetail
  isLoading: boolean
  canRequestRole: boolean
  isClosed: boolean
  profileNameMissing: boolean
  requestMutation: UseMutationResult<unknown, unknown, string>
  cancelMutation: UseMutationResult<unknown, unknown, string>
  t: (key: TranslationKey) => string
}

export default function MemberActions({
  event, isLoading, canRequestRole, isClosed, profileNameMissing, requestMutation, cancelMutation, t,
}: Props) {
  if (isLoading || !event) return null

  const roleSlots = event.role_slots ?? []
  const isMutating = requestMutation.isPending || cancelMutation.isPending
  const hasAnyRequest = roleSlots.some(s => s.caller_request !== null)
  const showNameGate = canRequestRole && profileNameMissing && !hasAnyRequest

  return (
    <div className="px-4 py-3 border-b border-black/5">
      <p className="text-[10px] font-semibold tracking-widest uppercase mb-3 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
        {t('event.roles')}
        {isClosed && <Lock size={10} />}
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
            const activeStyle = isActive ? REQUEST_STATUS_STYLES[myReq!.status] : null
            const slotStyle   = isFilled ? SLOT_STATUS_STYLES.filled : SLOT_STATUS_STYLES[slot.status]

            const isCancel        = isActive && myReq!.status === 'pending'
            const disabledCancel  = isMutating || isClosed
            const disabledRequest = isMutating || isFilled || hasAnyRequest || isClosed

            const occupantName = isFilled && slot.assigned_profile
              ? [slot.assigned_profile.first_name, slot.assigned_profile.last_name].filter(Boolean).join(' ') || null
              : null

            return (
              <div key={slot.role_label} className="flex-1 flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      if (isClosed) return
                      if (isCancel) cancelMutation.mutate(myReq!.id)
                      else if (!hasAnyRequest && !isFilled) requestMutation.mutate(slot.role_label)
                    }}
                    disabled={isCancel ? disabledCancel : disabledRequest}
                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-bold tracking-wider uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-95 active:scale-[0.97]"
                    style={{
                      backgroundColor: activeStyle ? activeStyle.bg : slotStyle.bg,
                      color: activeStyle ? activeStyle.color : slotStyle.color,
                      border: activeStyle ? `1px solid ${activeStyle.color}33` : '1px solid transparent',
                    }}
                  >
                    {slot.role_label}
                    {isActive && myReq!.status === 'pending' && <X size={10} className="opacity-60" />}
                    {isActive && myReq!.status === 'approved' && <Check size={10} />}
                    {isFilled && !isActive && <Check size={10} className="opacity-40" />}
                    {isClosed && !isActive && <Lock size={10} className="opacity-40" />}
                  </button>
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
