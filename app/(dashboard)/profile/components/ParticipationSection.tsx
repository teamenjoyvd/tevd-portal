'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { Drawer } from '@/components/ui/drawer'
import { formatDate } from '@/lib/format'
import { BentoHeader } from './BentoHeader'
import { BentoSkeleton } from './BentoSkeleton'
import { BentoEmpty } from './BentoEmpty'
import { type EventRoleRequest, VARIABLE_CAP, REG_STATUS_STYLES } from '../types'
import { ShowMoreButton } from './shared'
import { apiClient } from '@/lib/apiClient'

export function ParticipationSection({ profileId, role }: { profileId: string; role: string }) {
  const { t } = useLanguage()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const { data: eventRolesData, isLoading } = useQuery<EventRoleRequest[]>({
    queryKey: ['profile-event-roles'],
    queryFn: () => apiClient('/api/profile/event-roles'),
    enabled: !!profileId && role !== 'guest',
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <div>
        <BentoHeader icon={Users} title={t('profile.participation')} />
        <BentoSkeleton rows={2} />
      </div>
    )
  }

  const roles = eventRolesData ?? []
  const visible = roles.slice(0, VARIABLE_CAP)
  const overflow = roles.length - VARIABLE_CAP

  const RoleRow = ({ er }: { er: EventRoleRequest }) => {
    const rs = REG_STATUS_STYLES[er.status.toLowerCase()] ?? REG_STATUS_STYLES.pending
    return (
      <div className="flex items-start justify-between gap-3 text-xs py-1.5">
        <div className="min-w-0">
          <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{er.calendar_events?.title ?? '—'}</p>
          <p style={{ color: 'var(--text-secondary)' }}>
            {er.role_label}
            {er.calendar_events?.start_time && (
              <span className="ml-2">{formatDate(er.calendar_events.start_time)}</span>
            )}
          </p>
          {er.note && <p className="mt-0.5 italic" style={{ color: 'var(--text-secondary)' }}>{er.note}</p>}
        </div>
        <span className="font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: rs.bg, color: rs.color }}>{er.status}</span>
      </div>
    )
  }

  return (
    <>
      <div>
        <BentoHeader icon={Users} title={t('profile.participation')} />
        {roles.length === 0 ? (
          <BentoEmpty message={t('profile.participation.empty')} hint={t('profile.participation.emptyHint')} />
        ) : (
          <div className="space-y-2">
            {visible.map(er => <RoleRow key={er.id} er={er} />)}
          </div>
        )}
        {overflow > 0 && <ShowMoreButton count={overflow} onClick={() => setDrawerOpen(true)} />}
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={t('profile.allParticipation')}>
        <div className="space-y-2">
          {roles.map(er => <RoleRow key={er.id} er={er} />)}
        </div>
      </Drawer>
    </>
  )
}
