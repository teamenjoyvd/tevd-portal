'use client'

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/apiClient'
import type { TranslationKey } from '@/lib/i18n'
import { REGISTRATION_STATUS_STYLES } from './styles'
import type { EventRegistration } from './types'

type StatusKey = keyof typeof REGISTRATION_STATUS_STYLES

function isStatusKey(value: string): value is StatusKey {
  return value in REGISTRATION_STATUS_STYLES
}

type Props = {
  eventId: string
  t: (key: TranslationKey) => string
}

/**
 * The Registrations roster (2608-DEV-709). Every viewer hits the same route;
 * the tiering (admin all / core subtree / member own) is decided server-side
 * by get_event_registrations_for_viewer, so this component never filters.
 */
export default function RegistrationsTab({ eventId, t }: Props) {
  const { data, isLoading, isError } = useQuery<{ registrations: EventRegistration[] }>({
    queryKey: ['event-registrations', eventId],
    queryFn: () => apiClient(`/api/events/${eventId}/registrations`),
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

  // A failed fetch must not read as "nobody registered". The 403 branch is
  // reachable in normal use (the route rejects the guest role), so `data`
  // being undefined is not evidence of an empty roster.
  if (isError) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-xs" style={{ color: 'var(--brand-crimson)' }}>{t('cal.reg.error')}</p>
      </div>
    )
  }

  const registrations = data?.registrations ?? []

  if (registrations.length === 0) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('cal.reg.empty')}</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-3 space-y-2">
      {registrations.map(r => {
        const statusKey = isStatusKey(r.status) ? r.status : 'pending'
        const registrationStyle = REGISTRATION_STATUS_STYLES[statusKey]

        return (
          <div
            key={r.id}
            // Test hooks, same convention as PaymentsLedgerClient.tsx:209/289:
            // a registrant may ALSO appear as another row's sharer, so a bare
            // text locator is ambiguous by design of this list.
            data-testid="registration-row"
            className="rounded-lg p-2.5"
            style={{ backgroundColor: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.05)' }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p data-testid="registration-name" className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{r.registrant}</p>
                  {r.is_member && (
                    <span
                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: 'rgba(61,64,91,0.08)', color: '#3d405b' }}
                    >
                      {t('cal.reg.member')}
                    </span>
                  )}
                </div>
                {/* Member rows carry no email at all (the DB CHECK forces it
                    NULL), so this is an absence, not a masking decision. */}
                {r.email !== null && r.email !== '' && (
                  <p className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>{r.email}</p>
                )}
                {r.sharer_name !== null && r.sharer_name !== '' ? (
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {t('profile.invites.via')} <span style={{ color: 'var(--brand-teal)' }}>{r.sharer_name}</span>
                  </p>
                ) : (
                  !r.is_member && (
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{t('profile.invites.direct')}</p>
                  )
                )}
              </div>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: registrationStyle.bg, color: registrationStyle.color }}
              >
                {t(`cal.reg.status.${statusKey}` as `cal.reg.status.${StatusKey}`)}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
