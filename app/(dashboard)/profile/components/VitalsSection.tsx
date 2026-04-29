'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { Drawer } from '@/components/ui/drawer'
import { isVitalRecorded } from '@/lib/vitals'
import { type ProfileVitalSign, VARIABLE_CAP } from '../types'
import { ShowMoreButton } from './shared'
import { apiClient } from '@/lib/apiClient'

export const VITALS_MIN_HEIGHT = 280

export function VitalsSection({ profileId, role }: { profileId: string; role: string }) {
  const { t } = useLanguage()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const { data: vitalsData, isLoading } = useQuery<ProfileVitalSign[]>({
    queryKey: ['profile-vitals'],
    queryFn: () => apiClient('/api/profile/vital-signs'),
    enabled: !!profileId && role !== 'guest',
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return <div className="rounded-2xl animate-pulse h-full" style={{ backgroundColor: 'var(--border-default)' }} />
  }

  // Filter out rows with no definition (avoids rendering UUID fallback),
  // sort by sort_order ascending, then cap at VARIABLE_CAP for the bento view.
  const vitals = (vitalsData ?? [])
    .filter(vs => vs.vital_sign_definitions !== null)
    .sort((a, b) => (a.vital_sign_definitions!.sort_order) - (b.vital_sign_definitions!.sort_order))

  const visible = vitals.slice(0, VARIABLE_CAP)
  const overflow = vitals.length - VARIABLE_CAP

  const VitalCard = ({ vs }: { vs: ProfileVitalSign }) => {
    const label    = vs.vital_sign_definitions!.label
    const category = vs.vital_sign_definitions!.category
    const recorded = isVitalRecorded(vs)

    return (
      <div
        className="rounded-xl p-3 flex flex-col gap-1"
        style={{
          backgroundColor: recorded ? 'rgba(188,71,73,0.08)' : 'var(--bg-global)',
          border: `1px solid ${recorded ? 'rgba(188,71,73,0.2)' : 'var(--border-default)'}`,
        }}
      >
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full self-start"
          style={{
            backgroundColor: recorded ? 'rgba(188,71,73,0.12)' : 'var(--border-default)',
            color: recorded ? 'var(--brand-crimson)' : 'var(--text-secondary)',
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

  return (
    <>
      <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-4 pr-16" style={{ color: 'var(--brand-crimson)' }}>
          {t('profile.vitalSigns')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {visible.map(vs => <VitalCard key={vs.definition_id} vs={vs} />)}
        </div>
        {overflow > 0 && (
          <div className="mt-3">
            <ShowMoreButton count={overflow} onClick={() => setDrawerOpen(true)} />
          </div>
        )}
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={t('profile.allVitalSigns')}>
        <div className="grid grid-cols-2 gap-2">
          {vitals.map(vs => <VitalCard key={vs.definition_id} vs={vs} />)}
        </div>
      </Drawer>
    </>
  )
}
