'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo  } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { formatTime, formatLongDate } from '@/lib/format'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/popover'

type RoleRequest = {
  id: string
  role_label: string
  status: 'pending' | 'approved' | 'denied'
  note: string | null
  profile: { id: string; first_name: string; last_name: string; abo_number: string | null }
}

type CallerRequest = {
  id: string
  role_label: string
  status: 'pending' | 'approved' | 'denied'
  note: string | null
}

type EventDetail = {
  id: string
  title: string
  description: string | null
  meeting_url: string | null
  start_time: string
  end_time: string
  category: 'N21' | 'Personal'
  event_type: 'in-person' | 'online' | 'hybrid' | null
  week_number: number
  role_requests: RoleRequest[]
  caller_request: CallerRequest | null
}

type Props = {
  eventId: string
  anchorEl: HTMLElement | null
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

export default function EventPopup({
  eventId, anchorEl, onClose, userRole, userProfileId,
}: Props) {
  const qc = useQueryClient()
  const { t } = useLanguage()
  const [shareCopied, setShareCopied] = useState(false)
  const isBottomSheet = (anchorEl !== null) && (typeof window !== 'undefined') && window.innerWidth < 768
  const anchorElRef = useMemo(() => ({
    current: anchorEl ?? { getBoundingClientRect: () => new DOMRect(0, 0, 0, 0) },
  }), [anchorEl])

  const { data: event, isLoading } = useQuery<EventDetail>({
    queryKey: ['event', eventId],
    queryFn: () => fetch(`/api/events/${eventId}`).then(r => r.json()),
  })

  const isAdmin = userRole === 'admin'
  const canRequestRole = userRole && userRole !== 'guest'
  const isGuest = userRole === 'guest' || userRole === null

  const myRequest: CallerRequest | undefined = isAdmin
    ? event?.role_requests.find(r => r.profile?.id === userProfileId)
    : (event?.caller_request ?? undefined)

  const requestMutation = useMutation({
    mutationFn: (role_label: string) =>
      fetch(`/api/events/${eventId}/request-role`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_label }),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event', eventId] }),
  })

  const cancelMutation = useMutation({
    mutationFn: () => fetch(`/api/events/${eventId}/request-role`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event', eventId] }),
  })

  const adminApproveMutation = useMutation({
    mutationFn: ({ requestId, status }: { requestId: string; status: 'approved' | 'denied' }) =>
      fetch(`/api/admin/event-role-requests/${requestId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event', eventId] }),
  })

  async function handleShare() {
    const shareUrl = `${window.location.origin}/events/${eventId}/register`
    const shareData = { title: event?.title ?? '', text: `Register for ${event?.title ?? ''}`, url: shareUrl }
    if (typeof navigator.share === 'function' && navigator.canShare?.(shareData)) {
      try { await navigator.share(shareData); return } catch (err) { if (err instanceof Error && err.name === 'AbortError') return }
    }
    await navigator.clipboard.writeText(shareUrl)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }

  const eventTypeStyle = event?.event_type ? EVENT_TYPE_STYLES[event.event_type] : null
  const visibleRoleRequests = isAdmin
    ? (event?.role_requests ?? [])
    : (event?.role_requests ?? []).filter(r => r.profile?.id === userProfileId)
  const isMutating = requestMutation.isPending || cancelMutation.isPending

  // Header — DialogTitle inside Dialog (mobile), plain div on desktop (Popover has no Dialog context)
  function Header({ asDialogTitle }: { asDialogTitle: boolean }) {
    const titleClass = 'font-display text-base font-semibold leading-snug'
    const titleStyle = { color: 'var(--text-primary)' }
    return (
      <div className="px-4 pt-4 pb-3 border-b border-black/5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: event?.category === 'N21' ? 'var(--brand-forest)' : 'var(--brand-crimson)', color: 'rgba(255,255,255,0.9)' }}>
                {event?.category ?? '…'}
              </span>
              {eventTypeStyle && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: eventTypeStyle.bg, color: eventTypeStyle.color }}>
                  {eventTypeStyle.label}
                </span>
              )}
              {event && (
                <span className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>W{event.week_number}</span>
              )}
            </div>
            {asDialogTitle
              ? <DialogTitle className={titleClass} style={titleStyle}>{isLoading ? '…' : event?.title}</DialogTitle>
              : <p className={titleClass} style={titleStyle}>{isLoading ? '…' : event?.title}</p>
            }
          </div>
          <button onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors flex-shrink-0 mt-0.5"
            style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            ✕
          </button>
        </div>
      </div>
    )
  }

  // Body — DialogDescription inside Dialog (mobile), plain div on desktop
  function Body({ asDialogDescription }: { asDialogDescription: boolean }) {
    const inner = (
      <div className="overflow-y-auto" style={isBottomSheet ? undefined : { maxHeight: 360 }}>
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-6 rounded animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.06)' }} />
            ))}
          </div>
        ) : event ? (
          <>
            <div className="px-4 py-3 border-b border-black/5">
              <div className="flex items-center gap-2 text-xs mb-1" style={{ color: 'var(--text-primary)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="4" rx="2"/>
                  <line x1="16" x2="16" y1="2" y2="6"/>
                  <line x1="8" x2="8" y1="2" y2="6"/>
                  <line x1="3" x2="21" y1="10" y2="10"/>
                </svg>
                <span className="font-medium">{formatLongDate(event.start_time)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <span>{formatTime(event.start_time)} – {formatTime(event.end_time)}</span>
              </div>
              {event.meeting_url && (
                <div className="flex items-center gap-2 text-xs mt-1">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                  <a
                    href={event.meeting_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate hover:underline"
                    style={{ color: 'var(--brand-teal)' }}
                  >
                    {event.meeting_url}
                  </a>
                </div>
              )}
              {/* Share button */}
              <button
                onClick={handleShare}
                className="mt-3 flex items-center gap-1.5 text-xs font-medium hover:opacity-70 transition-opacity"
                style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"/>
                  <circle cx="6" cy="12" r="3"/>
                  <circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                {shareCopied ? 'Link copied!' : 'Share event'}
              </button>
            </div>
            {event.description && event.description !== event.meeting_url && (
              <div className="px-4 py-3 border-b border-black/5">
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{event.description}</p>
              </div>
            )}
            {!isGuest && (
              <div className="px-4 py-3">
                <p className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>
                  {t('event.roles')}
                </p>
                {isAdmin && (
                  visibleRoleRequests.length > 0 ? (
                    <div className="space-y-2">
                      {visibleRoleRequests.map(r => (
                        <div key={r.id} className="rounded-lg p-2.5" style={{ backgroundColor: STATUS_STYLES[r.status].bg }}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-medium mb-0.5" style={{ color: 'var(--text-primary)' }}>
                                {r.profile?.first_name} {r.profile?.last_name}
                                {r.profile?.abo_number && <span style={{ color: 'var(--text-secondary)' }}> · {r.profile.abo_number}</span>}
                              </p>
                              <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{r.role_label}</p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: 'rgba(255,255,255,0.6)', color: STATUS_STYLES[r.status].color }}>
                                {r.status}
                              </span>
                              {r.status === 'pending' && (
                                <>
                                  <button onClick={() => adminApproveMutation.mutate({ requestId: r.id, status: 'approved' })}
                                    className="text-[10px] px-2 py-0.5 rounded-full font-semibold text-white"
                                    style={{ backgroundColor: 'var(--brand-teal)' }}>✓</button>
                                  <button onClick={() => adminApproveMutation.mutate({ requestId: r.id, status: 'denied' })}
                                    className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-black/10"
                                    style={{ color: 'var(--text-secondary)' }}>✕</button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>No requests yet.</p>
                )}
                {!isAdmin && canRequestRole && (
                  <div className="flex gap-2">
                    {ROLE_PILLS.map(role => {
                      const isActive = myRequest?.role_label === role
                      const isDisabled = (!isActive && !!myRequest) || isMutating
                      const activeStyle = isActive ? STATUS_STYLES[myRequest!.status] : null
                      return (
                        <button key={role}
                          onClick={() => {
                            if (isActive && myRequest!.status === 'pending') cancelMutation.mutate()
                            else if (!myRequest) requestMutation.mutate(role)
                          }}
                          disabled={isDisabled || (isActive && myRequest!.status !== 'pending')}
                          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-bold tracking-wider uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-95 active:scale-[0.97]"
                          style={{
                            backgroundColor: activeStyle ? activeStyle.bg : 'rgba(0,0,0,0.05)',
                            color: activeStyle ? activeStyle.color : 'var(--text-primary)',
                            border: activeStyle ? `1px solid ${activeStyle.color}33` : '1px solid transparent',
                          }}>
                          {role}
                          {isActive && myRequest!.status === 'pending' && <span className="opacity-60">✕</span>}
                          {isActive && myRequest!.status === 'approved' && <span>✓</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        ) : null}
      </div>
    )

    if (asDialogDescription) {
      return <DialogDescription asChild>{inner}</DialogDescription>
    }
    return inner
  }

  return (
    <>
      {isBottomSheet ? (
        // Mobile: dim overlay + bottom-sheet Dialog
        <Dialog open onOpenChange={open => { if (!open) onClose() }}>
          <DialogOverlay style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} />
          <DialogContent
            style={{
              top: 'auto',
              bottom: 0,
              left: 0,
              right: 0,
              transform: 'none',
              borderRadius: '1rem 1rem 0 0',
              maxHeight: '85dvh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              backgroundColor: 'var(--bg-global)',
              boxShadow: '0 -4px 32px rgba(0,0,0,0.18)',
            }}
          >
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-8 h-1 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.15)' }} />
            </div>
            <Header asDialogTitle={true} />
            <Body asDialogDescription={true} />
          </DialogContent>
        </Dialog>
      ) : (
        // Desktop: Popover anchored to the live trigger element
        // DialogTitle/DialogDescription must NOT be used outside a Dialog context
        <Popover open onOpenChange={open => { if (!open) onClose() }}>
          <PopoverAnchor virtualRef={anchorElRef} />
          <PopoverContent
            side="bottom"
            sideOffset={8}
            align="center"
            style={{ width: 320, overflow: 'hidden' }}
            onOpenAutoFocus={e => e.preventDefault()}
          >
            <Header asDialogTitle={false} />
            <Body asDialogDescription={false} />
          </PopoverContent>
        </Popover>
      )}
    </>
  )
}
