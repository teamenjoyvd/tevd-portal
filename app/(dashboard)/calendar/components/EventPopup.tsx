'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { apiClient, ApiError } from '@/lib/apiClient'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import EventPopupShell from './popup/EventPopupShell'
import GuestActions from './popup/GuestActions'
import MemberActions from './popup/MemberActions'
import CoreAdminActions from './popup/CoreAdminActions'
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
  const [adminTab, setAdminTab]         = useState<'roles' | 'registrations'>('roles')

  const { data: event, isLoading } = useQuery<EventDetail>({
    queryKey: ['event', eventId],
    queryFn: () => apiClient(`/api/events/${eventId}`),
  })

  const isAdmin        = userRole === 'admin'
  const canRequestRole = !!userRole && userRole !== 'guest'
  const isGuest        = userRole === 'guest' || userRole === null

  // Role requests close 15 minutes before start. Admins always see full UI.
  const isClosed = !isAdmin && !!event &&
    Date.now() >= new Date(event.start_time).getTime() - 15 * 60 * 1000

  const isEventEnded = !!event && Date.now() >= new Date(event.end_time).getTime()

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

  const attendMutation = useMutation({
    mutationFn: () => apiClient<{ registrationId: string; emailed: boolean }>(
      `/api/events/${eventId}/attend`, { method: 'POST', body: JSON.stringify({}) },
    ),
    onSuccess: (data) => {
      // Only promise an email when one actually went out (2608-DEV-707) — a
      // member with no contact_email attends successfully and silently.
      toast.success(t(data.emailed ? 'cal.attendSuccessEmailed' : 'cal.attendSuccess'))
      qc.invalidateQueries({ queryKey: ['event', eventId] })
      qc.invalidateQueries({ queryKey: ['event-registrations', eventId] })
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : ''
      const key = message.includes('capacity') ? 'cal.attendFull'
        : message.includes('already ended') ? 'cal.attendClosed'
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

  const showMeta = !(isAdmin && adminTab === 'registrations')

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
      {isGuest ? (
        <GuestActions />
      ) : isAdmin ? (
        event && (
          <CoreAdminActions
            role="admin"
            event={event}
            isLoading={isLoading}
            eventId={eventId}
            adminTab={adminTab}
            setAdminTab={setAdminTab}
            isClosed={isClosed}
            canRequestRole={canRequestRole}
            profileNameMissing={profileNameMissing}
            requestMutation={requestMutation}
            cancelMutation={cancelMutation}
            t={t}
          />
        )
      ) : userRole === 'core' ? (
        event && (
          <CoreAdminActions
            role="core"
            event={event}
            isLoading={isLoading}
            eventId={eventId}
            adminTab={adminTab}
            setAdminTab={setAdminTab}
            isClosed={isClosed}
            canRequestRole={canRequestRole}
            profileNameMissing={profileNameMissing}
            requestMutation={requestMutation}
            cancelMutation={cancelMutation}
            t={t}
          />
        )
      ) : (
        event && (
          <MemberActions
            event={event}
            isLoading={isLoading}
            canRequestRole={canRequestRole}
            isClosed={isClosed}
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
