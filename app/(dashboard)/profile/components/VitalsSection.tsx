'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { HeartPulse } from 'lucide-react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { Drawer } from '@/components/ui/drawer'
import { isVitalRecorded } from '@/lib/vitals'
import { BentoHeader } from './BentoHeader'
import { BentoSkeleton } from './BentoSkeleton'
import { BentoEmpty } from './BentoEmpty'
import { type ProfileVitalSign, VARIABLE_CAP } from '../types'
import { ShowMoreButton } from './shared'
import { apiClient } from '@/lib/apiClient'

function VitalCard({ vs }: { vs: ProfileVitalSign }) {
  const { t } = useLanguage()
  const label    = vs.vital_sign_definitions!.label
  const category = vs.vital_sign_definitions!.category
  const recorded = isVitalRecorded(vs)

  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-1"
      style={{
        backgroundColor: recorded ? 'color-mix(in srgb, var(--brand-crimson) 8%, transparent)' : 'var(--bg-global)',
        border: `1px solid ${recorded ? 'color-mix(in srgb, var(--brand-crimson) 20%, transparent)' : 'var(--border-default)'}`,
      }}
    >
      <span
        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full self-start"
        style={{
          backgroundColor: recorded ? 'var(--status-alert-bg)' : 'var(--border-default)',
          color: recorded ? 'var(--status-alert-fg)' : 'var(--text-secondary)',
        }}
      >
        {recorded ? t('profile.vitalRecorded') : t('profile.vitalNotRecorded')}
      </span>
      <p className="text-xs font-semibold leading-snug mt-1" style={{ color: 'var(--text-primary)' }}>
        {label}
      </p>
      {category && (
        <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
          {category}
        </p>
      )}
    </div>
  )
}

export function VitalsSection({ profileId, role }: { profileId: string; role: string }) {
  const { t } = useLanguage()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const { data: vitalsData, isLoading } = useQuery<ProfileVitalSign[]>({
    queryKey: ['profile-vitals'],
    queryFn: () => apiClient('/api/profile/vital-signs'),
    enabled: !!profileId && role !== 'guest',
    staleTime: 5 * 60 * 1000,
  })

  // Must be above the isLoading guard — hooks cannot be called conditionally.
  // Filter out rows with no definition (avoids rendering UUID fallback),
  // sort by sort_order ascending, then cap at VARIABLE_CAP for the bento view.
  const vitals = useMemo(
    () =>
      (vitalsData ?? [])
        .filter(vs => vs.vital_sign_definitions !== null)
        .sort((a, b) => a.vital_sign_definitions!.sort_order - b.vital_sign_definitions!.sort_order),
    [vitalsData],
  )

  if (isLoading) {
    return (
      <div>
        <BentoHeader icon={HeartPulse} title={t('profile.vitalSigns')} subtitle={t('profile.vitalSigns.adminNote')} />
        <BentoSkeleton rows={2} />
      </div>
    )
  }

  const visible = vitals.slice(0, VARIABLE_CAP)
  const overflow = vitals.length - VARIABLE_CAP

  return (
    <>
      <div>
        <BentoHeader icon={HeartPulse} title={t('profile.vitalSigns')} subtitle={t('profile.vitalSigns.adminNote')} />
        {visible.length === 0 ? (
          <BentoEmpty message={t('profile.vitalSigns.empty')} />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {visible.map(vs => <VitalCard key={vs.definition_id} vs={vs} />)}
          </div>
        )}
        {overflow > 0 && <ShowMoreButton count={overflow} onClick={() => setDrawerOpen(true)} />}
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={t('profile.allVitalSigns')}>
        <div className="grid grid-cols-2 gap-2">
          {vitals.map(vs => <VitalCard key={vs.definition_id} vs={vs} />)}
        </div>
      </Drawer>
    </>
  )
}
