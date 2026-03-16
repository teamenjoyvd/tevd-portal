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

const AVAILABLE_ROLES = ['Speaker', 'Host', 'Moderator', 'Volunteer', 'Coordinator']

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
  const [selectedRole, setSelectedRole] = useState(AVAILABLE_ROLES[0])
  const [note, setNote] = useState('')
  const [showForm, setShowForm] = useState(false)
  // Start invisible — revealed only after position is calculated
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  const { data: event, isLoading } = useQuery<EventDetail>({
    queryKey: ['event', eventId],
    queryFn: () => fetch(`/api/events/${eventId}`).then(r => r.json()),
  })

  // Calculate popover position after we have both the anchor rect and a rendered size
  useEffect(() => {
    if (!anchorRect || !popoverRef.current) return
    const popover = popoverRef.current
    const popW = 320
    const popH = popover.offsetHeight || 420
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

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose])

  // Close on Escape
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
    mutationFn: () =>
      fetch(`/api/events/${eventId}/request-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_label: selectedRole, note: note || null }),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event', eventId] })
      setShowForm(false)
      setNote('')
    },
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

  // Visible roles: admin sees all, member sees only their own
  const visibleRoleRequests = isAdmin
    ? (event?.role_requests ?? [])
    : (event?.role_requests ?? []).filter(r => r.profile?.id === userProfileId)

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
        // Hide until position is resolved to prevent top-left flash
        opacity: position ? 1 : 0,
        pointerEvents: position ? 'auto' : 'none',
        transition: 'opacity 0.1s ease',
      }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-black/5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Pills row: category + event type + week */}
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
                  style={{
                    backgroundColor: eventTypeStyle.bg,
                    color: eventTypeStyle.color,
                  }}
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
              <p className="text-[10px] font-semibold tracking-widest uppercase mb-2"
                style={{ color: 'var(--stone)' }}>
                {t('event.roles')}
              </p>

              {/* Existing requests */}
              {visibleRoleRequests.map(r => (
                <div key={r.id}
                  className="rounded-lg p-2.5 mb-2"
                  style={{ backgroundColor: STATUS_STYLES[r.status].bg }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {isAdmin && (
                        <p className="text-[10px] font-medium mb-0.5"
                          style={{ color: 'var(--deep)' }}>
                          {r.profile?.first_name} {r.profile?.last_name}
                          {r.profile?.abo_number && (
                            <span style={{ color: 'var(--stone)' }}> · {r.profile.abo_number}</span>
                          )}
                        </p>
                      )}
                      <p className="text-xs font-semibold" style={{ color: 'var(--deep)' }}>
                        {r.role_label}
                      </p>
                      {r.note && (
                        <p className="text-[10px] mt-0.5 italic" style={{ color: 'var(--stone)' }}>
                          {r.note}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.6)',
                          color: STATUS_STYLES[r.status].color,
                        }}
                      >
                        {r.status}
                      </span>
                      {isAdmin && r.status === 'pending' && (
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
                      {!isAdmin && r.status === 'pending' && (
                        <button
                          onClick={() => cancelMutation.mutate()}
                          disabled={cancelMutation.isPending}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-black/10 disabled:opacity-50"
                          style={{ color: 'var(--stone)' }}
                        >
                          {t('event.cancel')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Empty state for members with no request */}
              {!isAdmin && visibleRoleRequests.length === 0 && !canRequestRole && (
                <p className="text-xs" style={{ color: 'var(--stone)' }}>
                  {t('event.signInForRole')}
                </p>
              )}

              {/* Request role form */}
              {canRequestRole && !myRequest && !isAdmin && (
                <>
                  {!showForm ? (
                    <button
                      onClick={() => setShowForm(true)}
                      className="w-full py-2 rounded-lg text-xs font-medium border-2 border-dashed transition-colors"
                      style={{ borderColor: 'var(--crimson)', color: 'var(--crimson)' }}
                    >
                      {t('event.requestRole')}
                    </button>
                  ) : (
                    <div className="rounded-lg border border-black/10 p-3 space-y-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {AVAILABLE_ROLES.map(role => (
                          <button
                            key={role}
                            onClick={() => setSelectedRole(role)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                            style={{
                              backgroundColor: selectedRole === role
                                ? 'var(--deep)'
                                : 'rgba(0,0,0,0.05)',
                              color: selectedRole === role ? 'white' : 'var(--deep)',
                            }}
                          >
                            {role}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        placeholder={t('event.notePlaceholder')}
                        rows={2}
                        className="w-full text-xs rounded-lg px-2.5 py-2 border border-black/10 resize-none"
                        style={{ color: 'var(--deep)' }}
                      />
                      {requestMutation.isError && (
                        <p className="text-[10px]" style={{ color: 'var(--crimson)' }}>
                          {(requestMutation.error as Error).message}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => requestMutation.mutate()}
                          disabled={requestMutation.isPending}
                          className="flex-1 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                          style={{ backgroundColor: 'var(--crimson)' }}
                        >
                          {requestMutation.isPending ? t('event.submitting') : t('event.submit')}
                        </button>
                        <button
                          onClick={() => { setShowForm(false); setNote('') }}
                          className="px-3 py-2 rounded-lg text-xs font-medium bg-black/5"
                          style={{ color: 'var(--stone)' }}
                        >
                          {t('event.cancel')}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
