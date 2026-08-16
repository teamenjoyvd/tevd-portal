'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { apiClient, ApiError } from '@/lib/apiClient'
import { isRoleWindowClosed } from '@/lib/events/role-cutoff'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import EventPopupShell from './popup/EventPopupShell'
import GuestActions from './popup/GuestActions'
import EventActionsTabs from './popup/EventActionsTabs'
import type { EventDetail } from './popup/types'

type Props = {
  eventId: string
  onClose: () => void
  userRole: 'admin' | 'core' | 'member' | 'guest' | null
  profileNameMissing?: boolean
}

export default function EventPopup({
  eventId, onClose, userRole, profileNameMissing = false,
}: Props) {
  const qc = useQueryClient()
  const { t } = useLanguage()
  const [shareCopied, setShareCopied]   = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const [qrLoading, setQrLoading]       = useState(false)
  const [qrDataUrl, setQrDataUrl]       = useState<string | null>(null)
  const [activeTab, setActiveTab]       = useState<'roles' | 'registrations'>('roles')

  const { data: event, isLoading } = useQuery<EventDetail>({
    queryKey: ['event', eventId],
    queryFn: () => apiClient(`/api/events/${eventId}`),
  })

  const isAdmin        = userRole === 'admin'
  const canRequestRole = !!userRole && userRole !== 'guest'
  const isGuest        = userRole === 'guest' || userRole === null
  // null == guest/anonymous, who get no tabs at all. Everyone else gets the
  // tabbed actions, including plain members since 2608-DEV-709.
  const actionsRole: 'admin' | 'core' | 'member' | null =
    userRole === 'guest' || userRole === null ? null : userRole

  // Role sign-ups close ROLE_CUTOFF_MS before start (60 min since
  // 2608-DEV-749, was 15). Admins always see the full UI. The window itself
  // lives in lib/events/role-cutoff.ts, shared with the route that enforces it.
  const isClosed = !isAdmin && !!event && isRoleWindowClosed(event.start_time)

  const isEventEnded = !!event && Date.now() >= new Date(event.end_time).getTime()

  const requestMutation = useMutation({
    mutationFn: (role_label: string) =>
      apiClient(`/api/events/${eventId}/request-role`, {
        method: 'POST',
        body: JSON.stringify({ role_label }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event', eventId] }),
    onError: (err: unknown) => {
      const code = err instanceof ApiError ? err.code : undefined
      const key = code === 'role_window_closed' ? 'cal.roleWindowClosed'
        : code === 'slot_filled' ? 'cal.roleSlotFilled'
        : code === 'already_requested' ? 'cal.roleAlreadyRequested'
        : 'cal.requestRoleError'
      toast.error(t(key))
      // slot_filled / state_changed mean this client is looking at a stale
      // board — refetch so the member sees what actually happened.
      qc.invalidateQueries({ queryKey: ['event', eventId] })
    },
  })

  // Takes no argument: the route identifies the row from the session + event id,
  // and the old `request_id` parameter was accepted and never sent.
  const cancelMutation = useMutation({
    mutationFn: () =>
      apiClient(`/api/events/${eventId}/request-role`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('cal.cancelRoleSuccess'))
      qc.invalidateQueries({ queryKey: ['event', eventId] })
    },
    // Same code-keyed branching as attendMutation — never match on err.message.
    onError: (err: unknown) => {
      const code = err instanceof ApiError ? err.code : undefined
      const key = code === 'role_window_closed' ? 'cal.roleWindowClosed'
        : code === 'nothing_to_cancel' ? 'cal.cancelRoleGone'
        : 'cal.cancelRoleError'
      toast.error(t(key))
    },
  })

  const attendMutation = useMutation({
    mutationFn: () => apiClient<{ registrationId: string; emailed: boolean }>(
      `/api/events/${eventId}/attend`, { method: 'POST', body: JSON.stringify({}) },
    ),
    onSuccess: (data) => {
      // Only promise an email when one actually went out (2608-DEV-707) — a
      // member with no contact_email attends successfully and silently.
      toast.success(t(data.emailed === true ? 'cal.attendSuccessEmailed' : 'cal.attendSuccess'))
      qc.invalidateQueries({ queryKey: ['event', eventId] })
      qc.invalidateQueries({ queryKey: ['event-registrations', eventId] })
    },
    onError: (err: unknown) => {
      // Keys off the AttendFailureCode the route sends (2608-DEV-733), not off
      // err.message — the message is English developer copy, so matching it
      // meant any reword of the server string silently downgraded this toast to
      // the generic error.
      const code = err instanceof ApiError ? err.code : undefined
      const key = code === 'event_full' ? 'cal.attendFull'
        : code === 'event_ended' ? 'cal.attendClosed'
        : 'cal.attendError'
      toast.error(t(key))
    },
  })

  const cancelAttendMutation = useMutation({
    mutationFn: () => apiClient(`/api/events/${eventId}/attend`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('cal.cancelAttendSuccess'))
      qc.invalidateQueries({ queryKey: ['event', eventId] })
      qc.invalidateQueries({ queryKey: ['event-registrations', eventId] })
    },
    onError: () => toast.error(t('cal.cancelAttendError')),
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
      // Never fall back to a token-less URL or a fake "copied" state — surface
      // the failure so the member knows the link was not shared.
      toast.error(t('cal.shareError'))
    } finally {
      setShareLoading(false)
    }
  }

  async function handleQrShare() {
    if (!event?.allow_guest_registration || qrLoading) return
    setQrLoading(true)
    try {
      const { token } = await apiClient<{ token: string }>('/api/profile/event-shares', {
        method: 'POST',
        body: JSON.stringify({ event_id: eventId, share_method: 'qr' }),
      })
      const shareUrl = `${window.location.origin}/events/${eventId}/register?share=${token}`
      const dataUrl  = await QRCode.toDataURL(shareUrl, { width: 512, margin: 2 })
      setQrDataUrl(dataUrl)
    } catch {
      toast.error(t('cal.shareError'))
    } finally {
      setQrLoading(false)
    }
  }

  function downloadQr() {
    if (!qrDataUrl) return
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = `event-${eventId}-qr.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  // Keys off the tab alone, for every role (2608-DEV-709 C6). Since
  // 2608-DEV-726 it gates the date/time/link meta and the description ONLY —
  // AttendSection and the share/QR buttons render on both tabs, so opening
  // Registrations no longer takes the primary action off the screen.
  const showMeta = activeTab !== 'registrations'

  return (
    <EventPopupShell
      event={event}
      isLoading={isLoading}
      onClose={onClose}
      isGuest={isGuest}
      showMeta={showMeta}
      shareLoading={shareLoading}
      shareCopied={shareCopied}
      qrLoading={qrLoading}
      qrDataUrl={qrDataUrl}
      onQrDismiss={() => setQrDataUrl(null)}
      onShare={handleShare}
      onQrShare={handleQrShare}
      downloadQr={downloadQr}
      isAdmin={isAdmin}
      isEventEnded={isEventEnded}
      attendPending={attendMutation.isPending || cancelAttendMutation.isPending}
      onAttend={() => attendMutation.mutate()}
      onCancelAttend={() => cancelAttendMutation.mutate()}
      t={t}
    >
      {actionsRole === null ? (
        <GuestActions />
      ) : (
        event && (
          <EventActionsTabs
            role={actionsRole}
            event={event}
            isLoading={isLoading}
            eventId={eventId}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isClosed={isClosed}
            canRequestRole={canRequestRole}
            profileNameMissing={profileNameMissing}
            requestMutation={requestMutation}
            cancelMutation={cancelMutation}
            t={t}
          />
        )
      )}
    </EventPopupShell>
  )
}
