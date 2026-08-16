'use client'

import { UseMutationResult } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import type { TranslationKey } from '@/lib/i18n'
import { PendingPopover } from './PendingPopover'
import MemberActions from './MemberActions'
import RegistrationsTab from './RegistrationsTab'
import { SLOT_STATUS_STYLES } from './styles'
import type { EventDetail, RoleSlot } from './types'

type Props = {
  role: 'admin' | 'core' | 'member'
  event: EventDetail
  isLoading: boolean
  eventId: string
  activeTab: 'roles' | 'registrations'
  setActiveTab: (tab: 'roles' | 'registrations') => void
  isClosed: boolean
  canRequestRole: boolean
  profileNameMissing: boolean
  requestMutation: UseMutationResult<unknown, unknown, string>
  // void, not string: the DELETE route resolves the row from the session and the
  // event id, so the old `request_id` argument was accepted and never sent.
  cancelMutation: UseMutationResult<unknown, unknown, void>
  t: (key: TranslationKey) => string
}

/**
 * Tabbed event actions for every signed-in role (2608-DEV-709; formerly
 * CoreAdminActions, which was admin-only and delegated core straight to
 * MemberActions).
 *
 * The tab bar is now shown to admin, core AND member. What differs per role is
 * only what the `roles` tab renders — the admin slot roster, or the member's
 * own request/cancel controls. The `registrations` tab is identical code for
 * everyone because the roster is tiered server-side by
 * get_event_registrations_for_viewer, not here.
 */
export default function EventActionsTabs({
  role, event, isLoading, eventId, activeTab, setActiveTab, isClosed,
  canRequestRole, profileNameMissing, requestMutation, cancelMutation, t,
}: Props) {
  if (isLoading || !event) return null

  const roleSlots = event.role_slots ?? []

  return (
    <>
      {/* Same bare role="tablist" as app/admin/components/LangTabs.tsx:14 —
          the tab labels are the accessible name, no separate aria-label. */}
      <div role="tablist" className="px-4 pt-3 pb-0 flex gap-1 border-b border-black/5">
        {(['roles', 'registrations'] as const).map(tab => (
          <button
            key={tab}
            role="tab"
            id={`event-tab-${tab}`}
            aria-selected={activeTab === tab}
            aria-controls={`event-tabpanel-${tab}`}
            onClick={() => setActiveTab(tab)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs font-semibold transition-colors"
            style={{
              backgroundColor: activeTab === tab ? 'var(--bg-global)' : 'transparent',
              color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab ? '2px solid var(--brand-crimson)' : '2px solid transparent',
            }}
          >
            {tab === 'registrations' && <Users size={10} />}
            {tab === 'roles' ? t('cal.tab.roles') : t('cal.tab.registrations')}
          </button>
        ))}
      </div>

      {activeTab === 'roles' && (
        <div role="tabpanel" id="event-tabpanel-roles" aria-labelledby="event-tab-roles">
        {role === 'admin' ? (
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
                    <div key={slot.role_label} className="rounded-container p-2.5" style={{ backgroundColor: slotStyle.bg }}>
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
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-xl"
                            style={{ backgroundColor: 'var(--bg-card-raised)', color: slotStyle.color }}>
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
        ) : (
          // core and member keep exactly the controls they had before this
          // ticket — the same MemberActions the old core branch delegated to.
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
        )}
        </div>
      )}

      {activeTab === 'registrations' && (
        <div role="tabpanel" id="event-tabpanel-registrations" aria-labelledby="event-tab-registrations">
          <RegistrationsTab eventId={eventId} t={t} />
        </div>
      )}
    </>
  )
}
