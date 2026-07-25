'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useLanguage } from '@/lib/hooks/useLanguage'
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
import { InvitesBento } from './InvitesBento'
import { BENTO_IDS, DEFAULT_ORDER } from './bento-registry'
import { apiClient } from '@/lib/apiClient'
import { useProfile } from '../useProfile'

// dnd-kit (@dnd-kit/core, /sortable, /utilities) lives entirely inside
// BentoGrid.tsx. Loading it via next/dynamic + an isDesktop gate keeps it
// out of the code path mobile actually executes.
const BentoGrid = dynamic(() => import('./BentoGrid'), { ssr: false })

// ── Types ────────────────────────────────────────────────────────────────────

type Props = {
  profileId:  string
  role:       string
  aboNumber:  string | null
  hasInvites: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BENTO_HEIGHT = { S: 160, M: 280 } as const
const DESKTOP_QUERY = '(min-width: 768px)' // matches Tailwind `md` breakpoint used below

// ── Component ─────────────────────────────────────────────────────────────────

export function ProfileClient({ profileId, role, aboNumber, hasInvites }: Props) {
  const { t } = useLanguage()

  const { data: fullProfile } = useProfile()

  const isGuest = role === 'guest' && !aboNumber
  const isAdmin = role === 'admin'
  const isCore = role === 'core'

  const [bentoOrder, setBentoOrder]         = useState<string[]>(DEFAULT_ORDER)
  const [bentoCollapsed, setBentoCollapsed] = useState<Record<string, boolean>>({})
  const [layoutRestored, setLayoutRestored] = useState(false)
  const [isDesktop, setIsDesktop]           = useState(false)
  const persistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY)
    setIsDesktop(mql.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    return () => {
      if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current)
    }
  }, [])

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

  const persistPrefs = useCallback((order: string[], collapsed: Record<string, boolean>) => {
    if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current)
    persistDebounceRef.current = setTimeout(() => {
      apiClient('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ ui_prefs: { bento_order: order, bento_collapsed: collapsed } }),
      }).catch(() => { /* silent */ })
    }, 500)
  }, [])

  const bentoCollapsedRef = useRef(bentoCollapsed)
  useEffect(() => {
    bentoCollapsedRef.current = bentoCollapsed
  }, [bentoCollapsed])

  const handleReorder = useCallback((next: string[]) => {
    if (!layoutRestored) return
    setBentoOrder(next)
    persistPrefs(next, bentoCollapsedRef.current)
  }, [persistPrefs, layoutRestored])

  const toggleCollapse = useCallback((id: string) => {
    if (!layoutRestored) return
    setBentoCollapsed(prev => {
      const next = { ...prev, [id]: !prev[id] }
      setBentoOrder(order => { persistPrefs(order, next); return order })
      return next
    })
  }, [persistPrefs, layoutRestored])

  const orderedBentosRef = useRef<{ id: string; entry: { colSpan: number; minHeight: number; node: React.ReactNode } }[]>([])

  const toggleAll = useCallback(() => {
    if (!layoutRestored) return
    const ids = orderedBentosRef.current.map(b => b.id)
    if (ids.length === 0) return
    const allCollapsed = ids.every(id => !!bentoCollapsedRef.current[id])
    const next = { ...bentoCollapsedRef.current }
    ids.forEach(id => { next[id] = !allCollapsed })
    setBentoCollapsed(next)
    setBentoOrder(order => { persistPrefs(order, next); return order })
  }, [persistPrefs, layoutRestored])

  const resetLayout = useCallback(() => {
    setBentoOrder(DEFAULT_ORDER)
    setBentoCollapsed({})
    persistPrefs(DEFAULT_ORDER, {})
  }, [persistPrefs])

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
    [BENTO_IDS.STATS]: (aboNumber !== null || isCore) ? {
      colSpan: 6, minHeight: STATS_MIN_HEIGHT,
      node: <StatsSection role={role} aboNumber={aboNumber} />,
    } : null,
    [BENTO_IDS.INVITES]: hasInvites ? {
      colSpan: 6, minHeight: BENTO_HEIGHT.M,
      node: <InvitesBento />,
    } : null,
    [BENTO_IDS.ADMIN]: isAdmin ? {
      colSpan: 6, minHeight: BENTO_HEIGHT.S,
      node: <AdminSection />,
    } : null,
  }

  const orderedBentos = bentoOrder
    .map(id => ({ id, entry: bentoMap[id] ?? null }))
    .filter((b): b is { id: string; entry: BentoEntry } => b.entry !== null)

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

        {/* Single mounted tree: desktop drag grid (dnd-kit, dynamically
            loaded) or the static mobile stack — never both at once. Server
            render and first client paint always take the static branch
            (isDesktop starts false), so hydration matches; the drag grid
            swaps in post-hydration once matchMedia resolves to desktop. */}
        {isDesktop ? (
          <BentoGrid
            orderedBentos={orderedBentos}
            bentoOrder={bentoOrder}
            bentoCollapsed={bentoCollapsed}
            onToggleCollapse={toggleCollapse}
            onReorder={handleReorder}
          />
        ) : (
          <div className="flex flex-col gap-3">
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
        )}

      </div>
    </div>
  )
}
