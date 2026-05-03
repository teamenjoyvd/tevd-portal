'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { formatTime, formatLongDate } from '@/lib/format'
import { X, Check, Users } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'

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
  role_requests: RoleRequest[]
  caller_request: CallerRequest | null
}

type Props = {
  eventId: string
  onClose: () => void
  userRole: 'admin' | 'core' | 'member' | 'guest' | null
  userProfileId: string | null
}

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

// ── Admin: guest registration list ────────────────────────────────────────────

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
                {g.sharer_name && (
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    via <span style={{ color: 'var(--brand-teal)' }}>{g.sharer_name}</span>
                  </p>
                )}
                {!g.sharer_name && (
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

// ── Main component ──────────────────────────────────────────────────────────

export default function EventPopup({
  eventId, onClose, userRole, userProfileId,
}: Props) {
  const qc = useQueryClient()
  const { t } = useLanguage()
  const [shareCopied, setShareCopied]     = useState(false)
  const [shareLoading, setShareLoading]   = useState(false)
  const [adminTab, setAdminTab]           = useState<'roles' | 'registrations'>('roles')

  const { data: event, isLoading } = useQuery<EventDetail>({
    queryKey: ['event', eventId],
    queryFn: () => apiClient(`/api/events/${eventId}`),
  })

  const isAdmin = userRole === 'admin'
  const canRequestRole = userRole && userRole !== 'guest'
  const isGuest = userRole === 'guest' || userRole === null

  // Role requests are closed 15 minutes before start. Admins always see the full UI.
  const isClosed = !isAdmin && !!event &&
    Date.now() >= new Date(event.start_time).getTime() - 15 * 60 * 1000

  const myRequest: CallerRequest | undefined = isAdmin
    ? event?.role_requests.find(r => r.profile?.id === userProfileId)
    : (event?.caller_request ?? undefined)

  const requestMutation = useMutation({
    mutationFn: (role_label: string) =>
      apiClient(`/api/events/${eventId}/request-role`, {
        method: 'POST',
        body: JSON.stringify({ role_label }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event', eventId] }),
  })

  const cancelMutation = useMutation({
    mutationFn: () => apiClient(`/api/events/${eventId}/request-role`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event', eventId] }),
  })

  const adminApproveMutation = useMutation({
    mutationFn: ({ requestId, status }: { requestId: string; status: 'approved' | 'denied' }) =>
      apiClient(`/api/admin/event-role-requests/${requestId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event', eventId] }),
  })

  async function handleShare() {
    if (!event?.allow_guest_registration || shareLoading) return
    setShareLoading(true)
    try {
      // Determine share method optimistically before the sheet opens
      const canNative = typeof navigator.share === 'function'
      const method: 'native' | 'clipboard' = canNative ? 'native' : 'clipboard'

      const { token } = await apiClient('/api/profile/event-shares', {
        method: 'POST',
        body: JSON.stringify({ event_id: eventId, share_method: method }),
      })

      const shareUrl  = `${window.location.origin}/events/${eventId}/register?share=${token}`
      const shareData = { title: event.title, text: `Register for ${event.title}`, url: shareUrl }

      if (canNative && navigator.canShare?.(shareData)) {
        try { await navigator.share(shareData); return } catch { /* cancelled */ }
      }
      // Clipboard fallback
      await navigator.clipboard.writeText(shareUrl)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    } catch {
      // If the API call fails, fall back to plain URL share without attribution
      const fallbackUrl = `${window.location.origin}/events/${eventId}/register`
      await navigator.clipboard.writeText(fallbackUrl).catch(() => {})
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    } finally {
      setShareLoading(false)
    }
  }

  const eventTypeStyle = event?.event_type ? EVENT_TYPE_STYLES[event.event_type] : null
  const availableRoles = event?.available_roles ?? ['HOST', 'SPEAKER', 'PRODUCTS']
  const visibleRoleRequests = isAdmin
    ? (event?.role_requests ?? [])
    : (event?.role_requests ?? []).filter(r => r.profile?.id === userProfileId)
  const isMutating = requestMutation.isPending || cancelMutation.isPending

  return (
    <>
      {/* Header */}
      <div className="px-4 pt-3 pb-3 border-b border-black/5 flex-shrink-0">
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

        {/* Admin tab bar — only rendered for admins */}
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

        {/* Roles */}
        {!isGuest && !isLoading && event && (adminTab === 'roles' || !isAdmin) && (
          <div className="px-4 py-3 border-b border-black/5">
            <p className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>
              {t('event.roles')}
            </p>

            {/* Admin: full request list with approve/deny */}
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
                                style={{ backgroundColor: 'var(--brand-teal)' }}><Check size={10} /></button>
                              <button onClick={() => adminApproveMutation.mutate({ requestId: r.id, status: 'denied' })}
                                className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-black/10"
                                style={{ color: 'var(--text-secondary)' }}><X size={10} /></button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('cal.noRequests')}</p>
            )}

            {/* Non-admin: existing request always shown read-only */}
            {!isAdmin && canRequestRole && myRequest && (
              <div className="rounded-lg p-2.5 mb-3" style={{ backgroundColor: STATUS_STYLES[myRequest.status].bg }}>
                <p className="text-[10px] font-medium mb-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {t('event.roles')}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{myRequest.role_label}</p>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: 'rgba(255,255,255,0.6)', color: STATUS_STYLES[myRequest.status].color }}>
                    {myRequest.status}
                  </span>
                </div>
              </div>
            )}

            {/* Non-admin: role request buttons — hidden when closed */}
            {!isAdmin && canRequestRole && (
              isClosed ? (
                !myRequest && (
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {t('cal.roleRequestsClosed')}
                  </p>
                )
              ) : (
                <div className="flex gap-2">
                  {availableRoles.map(role => {
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
                        {isActive && myRequest!.status === 'pending' && <X size={10} className="opacity-60" />}
                        {isActive && myRequest!.status === 'approved' && <Check size={10} />}
                      </button>
                    )
                  })}
                </div>
              )
            )}
          </div>
        )}

        {/* Admin: registrations tab content */}
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
