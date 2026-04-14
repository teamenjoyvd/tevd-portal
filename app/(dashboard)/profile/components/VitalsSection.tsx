'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Drawer } from '@/components/ui/Drawer'
import { isVitalRecorded } from '@/lib/vitals'
import { type ProfileVitalSign, VARIABLE_CAP } from '../types'
import { ShowMoreButton } from './shared'

export const VITALS_MIN_HEIGHT = 280

export function VitalsSection({ profileId, role }: { profileId: string; role: string }) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  const { data: vitalsData, isLoading } = useQuery<ProfileVitalSign[]>({
    queryKey: ['profile-vitals'],
    queryFn: () => fetch('/api/profile/vital-signs').then(r => r.json()),
    enabled: !!profileId && role !== 'guest',
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return <div className="rounded-2xl animate-pulse h-full" style={{ backgroundColor: 'var(--border-default)' }} />
  }

  const vitals = vitalsData ?? []
  const visible = vitals.slice(0, VARIABLE_CAP)
  const overflow = vitals.length - VARIABLE_CAP

  const VitalRow = ({ vs }: { vs: ProfileVitalSign }) => {
    const label = vs.vital_sign_definitions?.label ?? vs.definition_id
    const category = vs.vital_sign_definitions?.category
    const recorded = isVitalRecorded(vs)
    return (
      <div className="flex items-center justify-between gap-3 text-xs py-1.5">
        <div className="min-w-0">
          <span style={{ color: 'var(--text-primary)' }}>{label}</span>
          {category && <span className="ml-2 text-[10px]" style={{ color: 'var(--text-secondary)' }}>{category}</span>}
        </div>
        <span
          className="font-semibold px-2 py-0.5 rounded-full flex-shrink-0 text-[10px]"
          style={{
            backgroundColor: recorded ? 'rgba(188,71,73,0.12)' : 'var(--border-default)',
            color: recorded ? 'var(--brand-crimson)' : 'var(--text-secondary)',
          }}
        >
          {recorded ? '✓ Recorded' : '○ Not recorded'}
        </span>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-6 pr-16" style={{ color: 'var(--brand-crimson)' }}>Vital Signs</p>
        <div className="space-y-2">
          {visible.map(vs => <VitalRow key={vs.definition_id} vs={vs} />)}
        </div>
        {overflow > 0 && <ShowMoreButton count={overflow} onClick={() => setDrawerOpen(true)} />}
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="All Vital Signs">
        <div className="space-y-2">
          {vitals.map(vs => <VitalRow key={vs.definition_id} vs={vs} />)}
        </div>
      </Drawer>
    </>
  )
}
