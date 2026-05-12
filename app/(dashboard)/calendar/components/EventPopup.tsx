'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { formatTime, formatLongDate } from '@/lib/format'
import { X, Check, Users, Info } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

// ── Types ───────────────────────────────────────────────────────────────────────────

type CallerRequest = {
  id: string
  role_label: string
  status: 'pending' | 'approved' | 'denied'
}

type PendingProfile = {
  profile_id: string
  first_name: string | null
  last_name: string | null
}

type RoleSlot = {
  role_label: string
  status: 'open' | 'contested' | 'filled'
  assigned_profile: { first_name: string | null; last_name: string | null } | null
  pending_profiles: PendingProfile[]
  caller_request: CallerRequest | null
}

type GuestRegistration = {
  id: string
  name: string
  email: string
  status: string
  attended_at: string | null
  created_at: string
  sharer_name: string | null
}

type EventDetail = {
  id: string
  title: string
  description: string | null
  meeting_url: string | null
  allow_guest_registration: boolean
  available_roles: string[]
  start_time: string
  end_time: string
  category: 'N21' | 'Personal'
  event_type: 'in-person' | 'online' | 'hybrid' | null
  week_number: number
  role_slots: RoleSlot[]
}

type Props = {
  eventId: string
  onClose: () => void
  userRole: 'admin' | 'core' | 'member' | 'guest' | null
}

// ── Constants ─────────────────────────────────────────────────────────────────────

const REQUEST_STATUS_STYLES = {
  pending:  { bg: '#f2cc8f33', color: '#7a5c00'  },
  approved: { bg: '#81b29a33', color: '#2d6a4f'  },
  denied:   { bg: '#bc474920', color: '#bc4749'  },
}

const SLOT_STATUS_STYLES = {
  open:      { bg: 'rgba(0,0,0,0.05)',          color: 'var(--text-primary)'   },
  contested: { bg: 'rgba(242,204,143,0.22)',    color: '#7a5c00'               },
  filled:    { bg: 'rgba(129,178,154,0.22)',    color: '#2d6a4f'               },
}

const EVENT_TYPE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  'in-person': { bg: 'rgba(129,178,154,0.18)', color: '#2d6a4f',  label: 'In-Person' },
  'online':    { bg: 'rgba(61,64,91,0.10)',    color: '#3d405b',  label: 'Online'    },
  'hybrid':    { bg: 'rgba(242,204,143,0.35)', color: '#7a5c00',  label: 'Hybrid'    },
}

// ── PendingPopover ──────────────────────────────────────────────────────────────────

function PendingPopover({ profiles, color }: { profiles: PendingProfile[]; color: string }) {
  if (profiles.length === 0) return null
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0 hover:opacity-70 transition-opacity"
          style={{ color }}
          aria-label="View requesters"
        >
          <Info size={12} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        className="p-2 min-w-0 w-auto max-w-[200px]"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid rgba(0,0,0,0.08)' }}
      >
        <p className="text-[10px] font-semibold tracking-wider uppercase mb-1.5" style={{ color: 'var(--text-secondary)' }}>
          Requested by
        </p>
        <div className="space-y-0.5">
          {profiles.map((p) => {
            const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || '—'
            return (
              <p key={p.profile_id} className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                {name}
              </p>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ── Admin: guest registration list ────────────────────────────────────────────────────────

function AdminRegistrationsTab({ eventId }: { eventId: string }) {
  const { data, isLoading } = useQuery<{ registrations: GuestRegistration[] }>({
    queryKey: ['event-registrations', eventId],
    queryFn: () => apiClient(`/api/admin/events/${eventId}/registrations`),
  })

  if (isLoading) {
    return (
      <div className="px-4 py-3 space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-10 rounded-lg animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.06)' }} />
        ))}
      </div>
    )
  }

  const registrations = data?.registrations ?? []

  if (registrations.length === 0) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>No registrations yet.</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-3 space-y-2">
      {registrations.map(g => {
        const isAttended = !!g.attended_at
        const statusColor = isAttended ? '#2d6a4f' : g.status === 'confirmed' ? '#3d405b' : '#7a5c00'
        const statusBg    = isAttended ? 'rgba(129,178,154,0.2)' : g.status === 'confirmed' ? 'rgba(61,64,91,0.08)' : 'rgba(242,204,143,0.3)'
        const statusLabel = isAttended ? 'Attended' : g.status === 'confirmed' ? 'Confirmed' : 'Pending'

        return (
          <div
            key={g.id}
            className="rounded-lg p-2.5"
            style={{ backgroundColor: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.05)' }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{g.name}</p>
                <p className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>{g.email}</p>
                {g.sharer_name ? (
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    via <span style={{ color: 'var(--brand-teal)' }}>{g.sharer_name}</span>
                  </p>
                ) : (
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>Direct</p>
                )}
              </div>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: statusBg, color: statusColor }}
              >
                {statusLabel}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────────────────

export default function EventPopup({
  eventId, onClose, userRole,
}: Props) {
  const qc = useQueryClient()
  const { t } = useLanguage()
  const [shareCopied, setShareCopied]   = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const [adminTab, setAdminTab]         = useState<'roles' | 'registrations'>('roles')

  const { data: event, isLoading } = useQuery<EventDetail>({
    queryKey: ['event', eventId],
    queryFn: () => apiClient(`/api/events/${eventId}`),
  })

  const isAdmin        = userRole === 'admin'
  const canRequestRole = userRole && userRole !== 'guest'
  const isGuest        = userRole === 'guest' || userRole === null

  // Role requests close 15 minutes before start. Admins always see full UI.
  const isClosed = !isAdmin && !!event &&
    Date.now() >= new Date(event.start_time).getTime() - 15 * 60 * 1000

  const requestMutation = useMutation({
    mutationFn: (role_label: string) =>
      apiClient(`/api/events/${eventId}/request-role`, {
        method: 'POST',
        body: JSON.stringify({ role_label }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event', eventId] }),
  })

  const cancelMutation = useMutation({
    mutationFn: (request_id: string) =>
      apiClient(`/api/events/${eventId}/request-role`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event', eventId] }),
  })

  async function handleShare() {
    if (!event?.allow_guest_registration || shareLoading) return
    setShareLoading(true)
    try {
      const canNative = typeof navigator.share === 'function'
      const method: 'native' | 'clipboard' = canNative ? 'native' : 'clipboard'
      const { token } = await apiClient<{ token: string }>('/api/profile/event-shares', {
        method: 'POST',
        body: JSON.stringify({ event_id: eventId, share_method: method }),
      })
      const shareUrl  = `${window.location.origin}/events/${eventId}/register?share=${token}`
      const shareData = { title: event.title, text: `Register for ${event.title}`, url: shareUrl }
      if (canNative && navigator.canShare?.(shareData)) {
        try { await navigator.share(shareData); return } catch { /* cancelled */ }
      }
      await navigator.clipboard.writeText(shareUrl)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    } catch {
      const fallbackUrl = `${window.location.origin}/events/${eventId}/register`
      await navigator.clipboard.writeText(fallbackUrl).catch(() => {})
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    } finally {
      setShareLoading(false)
    }
  }

  const eventTypeStyle = event?.event_type ? EVENT_TYPE_STYLES[event.event_type] : null
  const roleSlots      = event?.role_slots ?? []
  const isMutating     = requestMutation.isPending || cancelMutation.isPending

  return (
    <>
      {/* Header */}
      <div className="px-4 pt-3 pb-3 border-b border-black/5 flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: event?.category === 'N21' ? 'var(--brand-forest)' : 'var(--sienna)', color: 'rgba(255,255,255,0.9)' }}>
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
            <p className="font-display text-base font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
              {isLoading ? '…' : event?.title}
            </p>
          </div>
          <button onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors flex-shrink-0 mt-0.5"
            style={{ color: 'var(--text-secondary)' }}>
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">

        {/* Admin tab bar */}
        {isAdmin && !isLoading && event && (
          <div className="px-4 pt-3 pb-0 flex gap-1 border-b border-black/5">
            {(['roles', 'registrations'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setAdminTab(tab)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs font-semibold transition-colors"
                style={{
                  backgroundColor: adminTab === tab ? 'var(--bg-global)' : 'transparent',
                  color: adminTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                  borderBottom: adminTab === tab ? '2px solid var(--brand-crimson)' : '2px solid transparent',
                }}
              >
                {tab === 'registrations' && <Users size={10} />}
                {tab === 'roles' ? 'Roles' : 'Registrations'}
              </button>
            ))}
          </div>
        )}

        {/* Roles section */}
        {!isGuest && !isLoading && event && (adminTab === 'roles' || !isAdmin) && (
          <div className="px-4 py-3 border-b border-black/5">
            <p className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>
              {t('event.roles')}
            </p>

            {/* Admin: slot overview — status + assigned occupant if filled + (i) if contested */}
            {isAdmin && (
              roleSlots.length > 0 ? (
                <div className="space-y-2">
                  {roleSlots.map(slot => {
                    const slotStyle = SLOT_STATUS_STYLES[slot.status]
                    const occupantName = slot.assigned_profile
                      ? [slot.assigned_profile.first_name, slot.assigned_profile.last_name].filter(Boolean).join(' ') || '—'
                      : null
                    return (
                      <div key={slot.role_label} className="rounded-lg p-2.5" style={{ backgroundColor: slotStyle.bg }}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{slot.role_label}</p>
                            {slot.status === 'filled' && occupantName && (
                              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{occupantName}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {slot.status === 'contested' && (
                              <PendingPopover profiles={slot.pending_profiles} color={slotStyle.color} />
                            )}
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: 'rgba(255,255,255,0.55)', color: slotStyle.color }}>
                              {t(`event.slot.${slot.status}` as `event.slot.${'open'|'contested'|'filled'}`)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('cal.noRequests')}</p>
              )
            )}

            {/* Non-admin: existing request read-only badge (shown above buttons) */}
            {!isAdmin && canRequestRole && (() => {
              const mySlot = roleSlots.find(s => s.caller_request !== null)
              const myReq  = mySlot?.caller_request ?? null
              return myReq ? (
                <div className="rounded-lg p-2.5 mb-3" style={{ backgroundColor: REQUEST_STATUS_STYLES[myReq.status].bg }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium mb-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {t('event.slot.yourRequest')}
                      </p>
                      <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{myReq.role_label}</p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'rgba(255,255,255,0.6)', color: REQUEST_STATUS_STYLES[myReq.status].color }}>
                      {myReq.status}
                    </span>
                  </div>
                </div>
              ) : null
            })()}

            {/* Non-admin: slot buttons — hidden when closed */}
            {!isAdmin && canRequestRole && (
              isClosed ? (
                !roleSlots.some(s => s.caller_request) && (
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {t('cal.roleRequestsClosed')}
                  </p>
                )
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {roleSlots.map(slot => {
                    const myReq     = slot.caller_request
                    const hasAnyReq = roleSlots.some(s => s.caller_request !== null)
                    const isActive  = myReq !== null
                    const isFilled  = slot.status === 'filled'
                    const activeStyle = isActive ? REQUEST_STATUS_STYLES[myReq!.status] : null
                    const slotStyle   = isFilled ? SLOT_STATUS_STYLES.filled : SLOT_STATUS_STYLES[slot.status]

                    const isCancel        = isActive && myReq!.status === 'pending'
                    const disabledCancel  = isMutating
                    const disabledRequest = isMutating || isFilled || hasAnyReq

                    const occupantName = isFilled && slot.assigned_profile
                      ? [slot.assigned_profile.first_name, slot.assigned_profile.last_name].filter(Boolean).join(' ') || null
                      : null

                    return (
                      // Wrapper div — button + (i) are siblings, never nested
                      <div key={slot.role_label} className="flex-1 flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              if (isCancel) cancelMutation.mutate(myReq!.id)
                              else if (!hasAnyReq && !isFilled) requestMutation.mutate(slot.role_label)
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
                            {isFilled && !isActive && (
                              <Check size={10} className="opacity-40" />
                            )}
                          </button>
                          {slot.status === 'contested' && slot.pending_profiles.length > 0 && (
                            <PendingPopover profiles={slot.pending_profiles} color={slotStyle.color} />
                          )}
                        </div>
                        {/* Approved occupant name — shown below filled slot */}
                        {occupantName && (
                          <p className="text-[10px] text-center" style={{ color: 'var(--text-secondary)' }}>
                            {occupantName}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            )}
          </div>
        )}

        {/* Admin: registrations tab */}
        {isAdmin && adminTab === 'registrations' && event && (
          <AdminRegistrationsTab eventId={eventId} />
        )}

        {/* Meta */}
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-6 rounded animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.06)' }} />
            ))}
          </div>
        ) : event && adminTab !== 'registrations' ? (
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
              {!isGuest && event.meeting_url && (
                <div className="flex items-center gap-2 text-xs mt-1">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                  <a href={event.meeting_url} target="_blank" rel="noopener noreferrer"
                    className="truncate hover:underline" style={{ color: 'var(--brand-teal)' }}>
                    {event.meeting_url}
                  </a>
                </div>
              )}
              {event.allow_guest_registration && !isGuest && (
                <button
                  onClick={handleShare}
                  disabled={shareLoading}
                  className="mt-3 flex items-center gap-1.5 text-xs font-medium hover:opacity-70 transition-opacity disabled:opacity-40"
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
                  {shareLoading ? '…' : shareCopied ? t('cal.linkCopied') : t('cal.shareEvent')}
                </button>
              )}
            </div>
            {event.description && event.description !== event.meeting_url && (
              <div className="px-4 py-3">
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{event.description}</p>
              </div>
            )}
          </>
        ) : null}

        {/* Scroll-fade */}
        <div aria-hidden style={{
          position: 'sticky', bottom: 0, left: 0, right: 0, height: 32,
          background: 'linear-gradient(to bottom, transparent, var(--bg-global))',
          pointerEvents: 'none',
        }} />
      </div>
    </>
  )
}
