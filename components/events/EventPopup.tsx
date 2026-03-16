'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'

type RoleRequest = {
  id: string
  role_label: string
  status: 'pending' | 'approved' | 'denied'
  note: string | null
  profile: { id: string; first_name: string; last_name: string; abo_number: string | null }
}

type EventDetail = {
  id: string
  title: string
  description: string | null
  start_time: string
  end_time: string
  category: 'N21' | 'Personal'
  event_type: 'in-person' | 'online' | 'hybrid' | null
  week_number: number
  role_requests: RoleRequest[]
}

type Props = {
  eventId: string
  anchorRect: DOMRect | null
  onClose: () => void
  userRole: 'admin' | 'core' | 'member' | 'guest' | null
  userProfileId: string | null
}

const ROLE_PILLS = ['HOST', 'SPEAKER', 'PRODUCT']

const STATUS_STYLES = {
  pending:  { bg: '#f2cc8f33', color: '#7a5c00'  },
  approved: { bg: '#81b29a33', color: '#2d6a4f'  },
  denied:   { bg: '#bc474920', color: '#bc4749'  },
}

const EVENT_TYPE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  'in-person': { bg: 'rgba(129,178,154,0.18)', color: '#2d6a4f',  label: 'In-Person' },
  'online':    { bg: 'rgba(61,64,91,0.10)',    color: '#3d405b',  label: 'Online'    },
  'hybrid':    { bg: 'rgba(242,204,143,0.35)', color: '#7a5c00',  label: 'Hybrid'    },
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }),
    time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  }
}

export default function EventPopup({
  eventId, anchorRect, onClose, userRole, userProfileId,
}: Props) {
  const qc = useQueryClient()
  const { t } = useLanguage()
  const popoverRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  const { data: event, isLoading } = useQuery<EventDetail>({
    queryKey: ['event', eventId],
    queryFn: () => fetch(`/api/events/${eventId}`).then(r => r.json()),
  })

  useEffect(() => {
    if (!anchorRect || !popoverRef.current) return
    const popW = 320
    const popH = popoverRef.current.offsetHeight || 420
    const vw = window.innerWidth
    const vh = window.innerHeight
    const scroll = window.scrollY

    let left = anchorRect.left + anchorRect.width / 2 - popW / 2
    let top  = anchorRect.bottom + scroll + 8

    left = Math.max(8, Math.min(left, vw - popW - 8))

    if (anchorRect.bottom + popH + 8 > vh) {
      top = anchorRect.top + scroll - popH - 8
    }

    setPosition({ top, left })
  }, [anchorRect, event])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose])

  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [onClose])

  const myRequest = event?.role_requests.find(r => r.profile?.id === userProfileId)
  const canRequestRole = userRole && userRole !== 'guest'
  const isAdmin = userRole === 'admin'

  const requestMutation = useMutation({
    mutationFn: (role_label: string) =>
      fetch(`/api/events/${eventId}/request-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_label }),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event', eventId] }),
  })

  const cancelMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/events/${eventId}/request-role`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event', eventId] }),
  })

  const adminApproveMutation = useMutation({
    mutationFn: ({ requestId, status }: { requestId: string; status: 'approved' | 'denied' }) =>
      fetch(`/api/admin/event-role-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event', eventId] }),
  })

  const start = event ? formatDateTime(event.start_time) : null
  const end   = event ? formatDateTime(event.end_time)   : null
  const eventTypeStyle = event?.event_type ? EVENT_TYPE_STYLES[event.event_type] : null

  const visibleRoleRequests = isAdmin
    ? (event?.role_requests ?? [])
    : (event?.role_requests ?? []).filter(r => r.profile?.id === userProfileId)

  const isMutating = requestMutation.isPending || cancelMutation.isPending

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 bg-white rounded-2xl overflow-hidden"
      style={{
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        width: 320,
        border: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
        opacity: position ? 1 : 0,
        pointerEvents: position ? 'auto' : 'none',
        transition: 'opacity 0.1s ease',
      }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-black/5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: event?.category === 'N21' ? 'var(--forest)' : 'var(--sienna)',
                  color: 'rgba(255,255,255,0.9)',
                }}
              >
                {event?.category ?? '…'}
              </span>
              {eventTypeStyle && (
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: eventTypeStyle.bg, color: eventTypeStyle.color }}
                >
                  {eventTypeStyle.label}
                </span>
              )}
              {event && (
                <span className="text-[10px] font-medium" style={{ color: 'var(--stone)' }}>
                  W{event.week_number}
                </span>
              )}
            </div>
            <h3
              className="font-serif text-base font-semibold leading-snug"
              style={{ color: 'var(--deep)' }}
            >
              {isLoading ? '…' : event?.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors flex-shrink-0 mt-0.5"
            style={{ color: 'var(--stone)', fontSize: 14 }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-6 rounded animate-pulse"
                style={{ backgroundColor: 'rgba(0,0,0,0.06)' }} />
            ))}
          </div>
        ) : event ? (
          <>
            {/* Date & time */}
            <div className="px-4 py-3 border-b border-black/5">
              <div className="flex items-center gap-2 text-xs mb-1" style={{ color: 'var(--deep)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="var(--stone)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="4" rx="2"/>
                  <line x1="16" x2="16" y1="2" y2="6"/>
                  <line x1="8" x2="8" y1="2" y2="6"/>
                  <line x1="3" x2="21" y1="10" y2="10"/>
                </svg>
                <span className="font-medium">{start?.date}</span>
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--stone)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="var(--stone)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <span>{start?.time} – {end?.time}</span>
              </div>
            </div>

            {/* Description */}
            {event.description && (
              <div className="px-4 py-3 border-b border-black/5">
                <p className="text-xs leading-relaxed" style={{ color: 'var(--stone)' }}>
                  {event.description}
                </p>
              </div>
            )}

            {/* Roles */}
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold tracking-widest uppercase mb-3"
                style={{ color: 'var(--stone)' }}>
                {t('event.roles')}
              </p>

              {/* Admin view: list all requests with approve/deny */}
              {isAdmin && (
                <>
                  {visibleRoleRequests.length > 0 ? (
                    <div className="space-y-2">
                      {visibleRoleRequests.map(r => (
                        <div key={r.id}
                          className="rounded-lg p-2.5"
                          style={{ backgroundColor: STATUS_STYLES[r.status].bg }}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-medium mb-0.5"
                                style={{ color: 'var(--deep)' }}>
                                {r.profile?.first_name} {r.profile?.last_name}
                                {r.profile?.abo_number && (
                                  <span style={{ color: 'var(--stone)' }}> · {r.profile.abo_number}</span>
                                )}
                              </p>
                              <p className="text-xs font-semibold" style={{ color: 'var(--deep)' }}>
                                {r.role_label}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: 'rgba(255,255,255,0.6)', color: STATUS_STYLES[r.status].color }}
                              >
                                {r.status}
                              </span>
                              {r.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => adminApproveMutation.mutate({ requestId: r.id, status: 'approved' })}
                                    className="text-[10px] px-2 py-0.5 rounded-full font-semibold text-white"
                                    style={{ backgroundColor: 'var(--sage)' }}
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={() => adminApproveMutation.mutate({ requestId: r.id, status: 'denied' })}
                                    className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-black/10"
                                    style={{ color: 'var(--stone)' }}
                                  >
                                    ✕
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs" style={{ color: 'var(--stone)' }}>No requests yet.</p>
                  )}
                </>
              )}

              {/* Member view: 3-pill role selection */}
              {!isAdmin && canRequestRole && (
                <div className="flex gap-2">
                  {ROLE_PILLS.map(role => {
                    const isActive   = myRequest?.role_label === role
                    const isDisabled = (!isActive && !!myRequest) || isMutating
                    const activeStyle = isActive ? STATUS_STYLES[myRequest!.status] : null

                    return (
                      <button
                        key={role}
                        onClick={() => {
                          if (isActive && myRequest!.status === 'pending') {
                            cancelMutation.mutate()
                          } else if (!myRequest) {
                            requestMutation.mutate(role)
                          }
                        }}
                        disabled={isDisabled || (isActive && myRequest!.status !== 'pending')}
                        className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-bold tracking-wider uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                          backgroundColor: activeStyle ? activeStyle.bg : 'rgba(0,0,0,0.05)',
                          color:           activeStyle ? activeStyle.color : 'var(--deep)',
                          border:          activeStyle ? `1px solid ${activeStyle.color}33` : '1px solid transparent',
                        }}
                      >
                        {role}
                        {isActive && myRequest!.status === 'pending'  && <span className="opacity-60">✕</span>}
                        {isActive && myRequest!.status === 'approved' && <span>✓</span>}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Guest / unauthenticated */}
              {!isAdmin && !canRequestRole && (
                <p className="text-xs" style={{ color: 'var(--stone)' }}>
                  {t('event.signInForRole')}
                </p>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}