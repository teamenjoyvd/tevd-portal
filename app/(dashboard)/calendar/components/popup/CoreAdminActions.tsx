'use client'

import { useQuery, UseMutationResult } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import type { TranslationKey } from '@/lib/i18n'
import { PendingPopover } from './PendingPopover'
import MemberActions from './MemberActions'
import { SLOT_STATUS_STYLES } from './styles'
import type { EventDetail, GuestRegistration, RoleSlot } from './types'

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

type Props = {
  role: 'admin' | 'core'
  event: EventDetail
  isLoading: boolean
  eventId: string
  adminTab: 'roles' | 'registrations'
  setAdminTab: (tab: 'roles' | 'registrations') => void
  isClosed: boolean
  canRequestRole: boolean
  profileNameMissing: boolean
  requestMutation: UseMutationResult<unknown, unknown, string>
  cancelMutation: UseMutationResult<unknown, unknown, string>
  t: (key: TranslationKey) => string
}

export default function CoreAdminActions({
  role, event, isLoading, eventId, adminTab, setAdminTab, isClosed,
  canRequestRole, profileNameMissing, requestMutation, cancelMutation, t,
}: Props) {
  // Current EventPopup.tsx has no core-specific branch anywhere — core behaves
  // identically to member (same canRequestRole/showNameGate logic). Delegate
  // rather than duplicate.
  if (role === 'core') {
    return (
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
  }

  if (isLoading || !event) return null

  const roleSlots = event.role_slots ?? []

  return (
    <>
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

      {adminTab === 'roles' && (
        <div className="px-4 py-3 border-b border-black/5">
          <p className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>
            {t('event.roles')}
          </p>
          {roleSlots.length > 0 ? (
            <div className="space-y-2">
              {roleSlots.map((slot: RoleSlot) => {
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
          )}
        </div>
      )}

      {adminTab === 'registrations' && (
        <AdminRegistrationsTab eventId={eventId} />
      )}
    </>
  )
}
