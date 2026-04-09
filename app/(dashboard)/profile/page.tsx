'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { PersonalDetailsContent } from './components/PersonalDetailsContent'
import { AboInfoContent } from './components/AboInfoContent'
import { TravelDocContent } from './components/TravelDocContent'
import { UserSettingsContent } from './components/UserSettingsContent'
import { SortableBento } from './components/SortableBento'
import { TripsSection, TRIPS_MIN_HEIGHT } from './components/TripsSection'
import { PaymentsSection, PAYMENTS_MIN_HEIGHT } from './components/PaymentsSection'
import { VitalsSection, VITALS_MIN_HEIGHT } from './components/VitalsSection'
import { ParticipationSection, PARTICIPATION_MIN_HEIGHT } from './components/ParticipationSection'
import { CalendarSection, CALENDAR_MIN_HEIGHT } from './components/CalendarSection'
import { StatsSection, STATS_MIN_HEIGHT } from './components/StatsSection'
import { AdminSection } from './components/AdminSection'
import { EmailPrefsSection, EMAIL_PREFS_MIN_HEIGHT } from './components/EmailPrefsSection'
import { type Profile, type VerificationRequest, type UplineData, type NotificationPrefs, DEFAULT_NOTIFICATION_PREFS } from './types'

// ── Constants ─────────────────────────────────────────────────────────────────

const BENTO_HEIGHT = { S: 160, M: 280 } as const

const BENTO_IDS = {
  PERSONAL_DETAILS: 'personal-details',
  ABO_INFO:         'abo-info',
  TRAVEL_DOC:       'travel-doc',
  SETTINGS:         'settings',
  TRIPS:            'trips',
  PAYMENTS:         'payments',
  EMAIL_PREFS:      'email_prefs',
  VITALS:           'vitals',
  PARTICIPATION:    'participation',
  CALENDAR:         'calendar',
  STATS:            'stats',
  ADMIN:            'admin',
}

const DEFAULT_ORDER: string[] = [
  BENTO_IDS.PERSONAL_DETAILS,
  BENTO_IDS.ABO_INFO,
  BENTO_IDS.TRIPS,
  BENTO_IDS.PAYMENTS,
  BENTO_IDS.EMAIL_PREFS,
  BENTO_IDS.VITALS,
  BENTO_IDS.PARTICIPATION,
  BENTO_IDS.SETTINGS,
  BENTO_IDS.TRAVEL_DOC,
  BENTO_IDS.CALENDAR,
  BENTO_IDS.STATS,
  BENTO_IDS.ADMIN,
]

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="py-8 pb-16">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 xl:px-8">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: '12px' }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ gridColumn: 'span 6', minHeight: BENTO_HEIGHT.M }} className="bento-mobile-full">
              <div className="h-full rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--border-default)' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const qc = useQueryClient()
  const { t } = useLanguage()

  // ── Layout state ─────────────────────────────────────────────────────────
  const [bentoOrder, setBentoOrder]         = useState<string[]>(DEFAULT_ORDER)
  const [bentoCollapsed, setBentoCollapsed] = useState<Record<string, boolean>>({})
  const persistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Profile query (page gate) ─────────────────────────────────────────────
  const { data: profile, isLoading } = useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: () => fetch('/api/profile').then(r => r.json()),
  })

  const validProfile = profile?.id ? profile : null

  // ── ABO queries (needed for AboInfoContent + bento gating) ───────────────
  const { data: verRequest } = useQuery<VerificationRequest | null>({
    queryKey: ['verify-abo'],
    queryFn: () => fetch('/api/profile/verify-abo').then(r => r.json()),
    enabled: !!validProfile && validProfile.role === 'guest',
  })

  const { data: uplineData } = useQuery<UplineData>({
    queryKey: ['profile-upline'],
    queryFn: () => fetch('/api/profile/upline').then(r => r.json()),
    enabled: !!validProfile?.abo_number,
    staleTime: 10 * 60 * 1000,
  })

  const submitVerification = useMutation({
    mutationFn: (params: { claimed_abo?: string; claimed_upline_abo: string; request_type: 'standard' | 'manual' }) =>
      fetch('/api/profile/verify-abo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          params.request_type === 'manual'
            ? { request_type: 'manual', claimed_upline_abo: params.claimed_upline_abo }
            : { claimed_abo: params.claimed_abo, claimed_upline_abo: params.claimed_upline_abo }
        ),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['verify-abo'] }),
  })

  const cancelVerification = useMutation({
    mutationFn: () => fetch('/api/profile/verify-abo', { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['verify-abo'] }),
  })

  // ── Restore persisted bento layout ───────────────────────────────────────
  useEffect(() => {
    if (!validProfile) return
    const prefs = validProfile.ui_prefs ?? {}
    if (Array.isArray(prefs.bento_order) && prefs.bento_order.length > 0) {
      const savedOrder = prefs.bento_order as string[]
      const merged = [
        ...savedOrder.filter(id => DEFAULT_ORDER.includes(id)),
        ...DEFAULT_ORDER.filter(id => !savedOrder.includes(id)),
      ]
      setBentoOrder(merged)
    }
    if (prefs.bento_collapsed && typeof prefs.bento_collapsed === 'object') {
      setBentoCollapsed(prefs.bento_collapsed as Record<string, boolean>)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validProfile?.id])

  // ── Persist bento prefs ───────────────────────────────────────────────────
  const persistPrefs = useCallback((order: string[], collapsed: Record<string, boolean>) => {
    if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current)
    persistDebounceRef.current = setTimeout(() => {
      fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ui_prefs: { bento_order: order, bento_collapsed: collapsed } }),
      }).catch(() => { /* silent */ })
    }, 500)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setBentoOrder(prev => {
      const oldIndex = prev.indexOf(active.id as string)
      const newIndex = prev.indexOf(over.id as string)
      const next = arrayMove(prev, oldIndex, newIndex)
      persistPrefs(next, bentoCollapsed)
      return next
    })
  }, [bentoCollapsed, persistPrefs])

  const toggleCollapse = useCallback((id: string) => {
    setBentoCollapsed(prev => {
      const next = { ...prev, [id]: !prev[id] }
      setBentoOrder(order => { persistPrefs(order, next); return order })
      return next
    })
  }, [persistPrefs])

  const resetLayout = useCallback(() => {
    setBentoOrder(DEFAULT_ORDER)
    setBentoCollapsed({})
    persistPrefs(DEFAULT_ORDER, {})
  }, [persistPrefs])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (isLoading || !validProfile) return <ProfileSkeleton />

  const p = validProfile
  const isGuest = p.role === 'guest' && !p.abo_number
  const isAdmin = p.role === 'admin'

  type AboMode = 'form' | 'pending' | 'confirmed' | 'member_manual'
  let aboMode: AboMode = 'form'
  if (p.abo_number) {
    aboMode = 'confirmed'
  } else if (p.role !== 'guest') {
    aboMode = 'member_manual'
  } else if (verRequest && (verRequest.status === 'pending' || verRequest.status === 'denied')) {
    aboMode = 'pending'
  }

  // ── Bento map ─────────────────────────────────────────────────────────────
  type BentoEntry = { colSpan: number; minHeight: number; node: React.ReactNode }

  const bentoMap: Record<string, BentoEntry | null> = {
    [BENTO_IDS.PERSONAL_DETAILS]: {
      colSpan: 6, minHeight: BENTO_HEIGHT.M,
      node: <PersonalDetailsContent profile={p} incomplete={!p.first_name} />,
    },
    [BENTO_IDS.ABO_INFO]: {
      colSpan: 6, minHeight: BENTO_HEIGHT.M,
      node: (
        <AboInfoContent
          mode={aboMode} role={p.role} aboNumber={p.abo_number}
          uplineData={uplineData} verRequest={verRequest}
          onSubmitVerification={params => submitVerification.mutate(params)}
          onCancelVerification={() => cancelVerification.mutate()}
          submitPending={submitVerification.isPending}
          cancelPending={cancelVerification.isPending}
          submitError={submitVerification.isError ? (submitVerification.error as Error).message : null}
        />
      ),
    },
    [BENTO_IDS.TRAVEL_DOC]: !isGuest ? {
      colSpan: 6, minHeight: BENTO_HEIGHT.S,
      node: <TravelDocContent profile={p} />,
    } : null,
    [BENTO_IDS.SETTINGS]: {
      colSpan: 6, minHeight: BENTO_HEIGHT.M,
      node: <UserSettingsContent />,
    },
    [BENTO_IDS.TRIPS]: !isGuest ? {
      colSpan: 6, minHeight: TRIPS_MIN_HEIGHT,
      node: <TripsSection profileId={p.id} role={p.role} />,
    } : null,
    [BENTO_IDS.PAYMENTS]: !isGuest ? {
      colSpan: 6, minHeight: PAYMENTS_MIN_HEIGHT,
      node: <PaymentsSection profileId={p.id} role={p.role} />,
    } : null,
    [BENTO_IDS.EMAIL_PREFS]: !isGuest ? {
      colSpan: 6, minHeight: EMAIL_PREFS_MIN_HEIGHT,
      node: <EmailPrefsSection prefs={p.notification_prefs ?? DEFAULT_NOTIFICATION_PREFS} />,
    } : null,
    [BENTO_IDS.VITALS]: !isGuest ? {
      colSpan: 6, minHeight: VITALS_MIN_HEIGHT,
      node: <VitalsSection profileId={p.id} role={p.role} />,
    } : null,
    [BENTO_IDS.PARTICIPATION]: !isGuest ? {
      colSpan: 6, minHeight: PARTICIPATION_MIN_HEIGHT,
      node: <ParticipationSection profileId={p.id} role={p.role} />,
    } : null,
    [BENTO_IDS.CALENDAR]: {
      colSpan: 6, minHeight: CALENDAR_MIN_HEIGHT,
      node: <CalendarSection profileId={p.id} />,
    },
    [BENTO_IDS.STATS]: p.abo_number ? {
      colSpan: 6, minHeight: STATS_MIN_HEIGHT,
      node: <StatsSection role={p.role} aboNumber={p.abo_number} />,
    } : null,
    [BENTO_IDS.ADMIN]: isAdmin ? {
      colSpan: 6, minHeight: BENTO_HEIGHT.S,
      node: <AdminSection />,
    } : null,
  }

  const orderedBentos = bentoOrder
    .map(id => ({ id, entry: bentoMap[id] ?? null }))
    .filter((b): b is { id: string; entry: BentoEntry } => b.entry !== null)

  return (
    <div className="py-8 pb-16">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 xl:px-8">

        <div className="flex justify-end mb-3">
          <button
            onClick={resetLayout}
            className="text-xs font-medium hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('profile.resetLayout')}
          </button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedBentos.map(b => b.id)} strategy={rectSortingStrategy}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: '12px' }}>
              {orderedBentos.map(({ id, entry }) => (
                <SortableBento
                  key={id}
                  id={id}
                  collapsed={!!bentoCollapsed[id]}
                  onToggleCollapse={() => toggleCollapse(id)}
                  colSpan={entry.colSpan}
                  minHeight={entry.minHeight}
                >
                  {entry.node}
                </SortableBento>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  )
}
