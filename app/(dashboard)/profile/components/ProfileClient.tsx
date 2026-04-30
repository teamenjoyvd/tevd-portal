'use client'

import { useQuery } from '@tanstack/react-query'
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
import { PersonalDetailsContent } from './PersonalDetailsContent'
import { AboInfoContent } from './AboInfoContent'
import { TravelDocContent } from './TravelDocContent'
import { UserSettingsContent } from './UserSettingsContent'
import { SortableBento } from './SortableBento'
import { TripsSection, TRIPS_MIN_HEIGHT } from './TripsSection'
import { PaymentsSection, PAYMENTS_MIN_HEIGHT } from './PaymentsSection'
import { VitalsSection, VITALS_MIN_HEIGHT } from './VitalsSection'
import { ParticipationSection, PARTICIPATION_MIN_HEIGHT } from './ParticipationSection'
import { CalendarSection, CALENDAR_MIN_HEIGHT } from './CalendarSection'
import { StatsSection, STATS_MIN_HEIGHT } from './StatsSection'
import { AdminSection } from './AdminSection'
import { EmailPrefsSection, EMAIL_PREFS_MIN_HEIGHT } from './EmailPrefsSection'
import { type Profile } from '../types'
import { apiClient } from '@/lib/apiClient'

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  profileId: string
  role: string
  aboNumber: string | null
}

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
  BENTO_IDS.TRAVEL_DOC,
  BENTO_IDS.CALENDAR,
  BENTO_IDS.PARTICIPATION,
  BENTO_IDS.VITALS,
  BENTO_IDS.TRIPS,
  BENTO_IDS.PAYMENTS,
  BENTO_IDS.SETTINGS,
  BENTO_IDS.EMAIL_PREFS,
  BENTO_IDS.STATS,
  BENTO_IDS.ADMIN,
]

// ── Component ─────────────────────────────────────────────────────────────────

export function ProfileClient({ profileId, role, aboNumber }: Props) {
  const { t } = useLanguage()

  // ── Full profile — read from cache for ui_prefs once content tiles populate it.
  // ProfileClient never fetches the full profile itself.
  const { data: fullProfile } = useQuery<Profile>({
    queryKey: ['profile'],
    enabled: false, // never fetch from here — read cache only
  })

  const isGuest = role === 'guest' && !aboNumber
  const isAdmin = role === 'admin'

  // ── Layout state ─────────────────────────────────────────────────────────
  const [bentoOrder, setBentoOrder]         = useState<string[]>(DEFAULT_ORDER)
  const [bentoCollapsed, setBentoCollapsed] = useState<Record<string, boolean>>({})
  const [layoutRestored, setLayoutRestored] = useState(false)
  const persistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear debounce timer on unmount to prevent stale API calls
  useEffect(() => {
    return () => {
      if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current)
    }
  }, [])

  // ── Restore persisted bento layout from full profile cache ───────────────
  useEffect(() => {
    if (layoutRestored || !fullProfile?.id) return
    const prefs = (fullProfile.ui_prefs ?? {}) as Record<string, unknown>
    if (Array.isArray(prefs.bento_order) && (prefs.bento_order as string[]).length > 0) {
      const savedOrder = prefs.bento_order as string[]
      const merged = [
        ...savedOrder.filter((id: string) => DEFAULT_ORDER.includes(id)),
        ...DEFAULT_ORDER.filter(id => !savedOrder.includes(id)),
      ]
      setBentoOrder(merged)
    }
    if (prefs.bento_collapsed && typeof prefs.bento_collapsed === 'object') {
      setBentoCollapsed(prefs.bento_collapsed as Record<string, boolean>)
    }
    setLayoutRestored(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullProfile?.id])

  // ── Persist bento prefs ───────────────────────────────────────────────────
  const persistPrefs = useCallback((order: string[], collapsed: Record<string, boolean>) => {
    if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current)
    persistDebounceRef.current = setTimeout(() => {
      apiClient('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ ui_prefs: { bento_order: order, bento_collapsed: collapsed } }),
      }).catch(() => { /* silent */ })
    }, 500)
  }, [])

  // Stable ref for bentoCollapsed — allows event handlers to read current
  // collapsed state without stale closures, without re-creating callbacks.
  const bentoCollapsedRef = useRef(bentoCollapsed)
  useEffect(() => {
    bentoCollapsedRef.current = bentoCollapsed
  }, [bentoCollapsed])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = bentoOrder.indexOf(active.id as string)
    const newIndex = bentoOrder.indexOf(over.id as string)
    const next = arrayMove(bentoOrder, oldIndex, newIndex)
    setBentoOrder(next)
    persistPrefs(next, bentoCollapsedRef.current)
  }, [bentoOrder, persistPrefs])

  const toggleCollapse = useCallback((id: string) => {
    setBentoCollapsed(prev => {
      const next = { ...prev, [id]: !prev[id] }
      // Read current order from state setter arg to avoid stale closure
      setBentoOrder(order => { persistPrefs(order, next); return order })
      return next
    })
  }, [persistPrefs])

  const orderedBentosRef = useRef<{ id: string; entry: { colSpan: number; minHeight: number; node: React.ReactNode } }[]>([])

  const toggleAll = useCallback(() => {
    const ids = orderedBentosRef.current.map(b => b.id)
    if (ids.length === 0) return
    const allCollapsed = ids.every(id => !!bentoCollapsedRef.current[id])
    const next = { ...bentoCollapsedRef.current }
    ids.forEach(id => { next[id] = !allCollapsed })
    setBentoCollapsed(next)
    setBentoOrder(order => { persistPrefs(order, next); return order })
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

  // ── Bento map ─────────────────────────────────────────────────────────────
  type BentoEntry = { colSpan: number; minHeight: number; node: React.ReactNode }

  const bentoMap: Record<string, BentoEntry | null> = {
    [BENTO_IDS.PERSONAL_DETAILS]: {
      colSpan: 6, minHeight: BENTO_HEIGHT.M,
      node: <PersonalDetailsContent />,
    },
    [BENTO_IDS.ABO_INFO]: {
      colSpan: 6, minHeight: BENTO_HEIGHT.M,
      node: <AboInfoContent />,
    },
    [BENTO_IDS.TRAVEL_DOC]: !isGuest ? {
      colSpan: 6, minHeight: BENTO_HEIGHT.S,
      node: <TravelDocContent />,
    } : null,
    [BENTO_IDS.SETTINGS]: {
      colSpan: 6, minHeight: BENTO_HEIGHT.M,
      node: <UserSettingsContent />,
    },
    [BENTO_IDS.TRIPS]: !isGuest ? {
      colSpan: 6, minHeight: TRIPS_MIN_HEIGHT,
      node: <TripsSection profileId={profileId} role={role} />,
    } : null,
    [BENTO_IDS.PAYMENTS]: !isGuest ? {
      colSpan: 6, minHeight: PAYMENTS_MIN_HEIGHT,
      node: <PaymentsSection profileId={profileId} role={role} />,
    } : null,
    [BENTO_IDS.EMAIL_PREFS]: !isGuest ? {
      colSpan: 6, minHeight: EMAIL_PREFS_MIN_HEIGHT,
      node: <EmailPrefsSection />,
    } : null,
    [BENTO_IDS.VITALS]: !isGuest ? {
      colSpan: 6, minHeight: VITALS_MIN_HEIGHT,
      node: <VitalsSection profileId={profileId} role={role} />,
    } : null,
    [BENTO_IDS.PARTICIPATION]: !isGuest ? {
      colSpan: 6, minHeight: PARTICIPATION_MIN_HEIGHT,
      node: <ParticipationSection profileId={profileId} role={role} />,
    } : null,
    [BENTO_IDS.CALENDAR]: {
      colSpan: 6, minHeight: CALENDAR_MIN_HEIGHT,
      node: <CalendarSection profileId={profileId} />,
    },
    [BENTO_IDS.STATS]: aboNumber ? {
      colSpan: 6, minHeight: STATS_MIN_HEIGHT,
      node: <StatsSection role={role} aboNumber={aboNumber} />,
    } : null,
    [BENTO_IDS.ADMIN]: isAdmin ? {
      colSpan: 6, minHeight: BENTO_HEIGHT.S,
      node: <AdminSection />,
    } : null,
  }

  const orderedBentos = bentoOrder
    .map(id => ({ id, entry: bentoMap[id] ?? null }))
    .filter((b): b is { id: string; entry: BentoEntry } => b.entry !== null)

  // Keep ref in sync via effect — safe for concurrent rendering
  useEffect(() => {
    orderedBentosRef.current = orderedBentos
  }, [orderedBentos])

  const allCollapsed = orderedBentos.every(({ id }) => !!bentoCollapsed[id])

  return (
    <div className="py-8 pb-16">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 xl:px-8">

        <div className="flex justify-end gap-4 mb-3">
          <button
            onClick={toggleAll}
            className="text-xs font-medium hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-secondary)' }}
          >
            {allCollapsed ? t('profile.expandAll') : t('profile.collapseAll')}
          </button>
          <button
            onClick={resetLayout}
            className="text-xs font-medium hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('profile.resetLayout')}
          </button>
        </div>

        {/* ── DESKTOP (md+) — DnD grid ──────────────────────────────────── */}
        <div className="hidden md:block">
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

        {/* ── MOBILE (< md) — stacked flex, no DnD ─────────────────────── */}
        <div className="md:hidden flex flex-col gap-3">
          {orderedBentos.map(({ id, entry }) => (
            <SortableBento
              key={id}
              id={id}
              collapsed={!!bentoCollapsed[id]}
              onToggleCollapse={() => toggleCollapse(id)}
              colSpan={entry.colSpan}
              minHeight={entry.minHeight}
              disableDrag
            >
              {entry.node}
            </SortableBento>
          ))}
        </div>

      </div>
    </div>
  )
}
