'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { PersonalDetailsContent } from './PersonalDetailsContent'
import { AboInfoContent } from './AboInfoContent'
import { TravelDocContent } from './TravelDocContent'
import { UserSettingsContent } from './UserSettingsContent'
import { SortableBento } from './SortableBento'
import { TripsSection } from './TripsSection'
import { PaymentsSection } from './PaymentsSection'
import { VitalsSection } from './VitalsSection'
import { ParticipationSection } from './ParticipationSection'
import { CalendarSection } from './CalendarSection'
import { StatsSection } from './StatsSection'
import { AdminSection } from './AdminSection'
import { EmailPrefsSection } from './EmailPrefsSection'
import { InvitesBento } from './InvitesBento'
import { BENTO_IDS, DEFAULT_ORDER, BENTO_META, BENTO_HEIGHT, type BentoId } from './bento-registry'
import { apiClient } from '@/lib/apiClient'
import { toast } from '@/lib/toast'
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

const DESKTOP_QUERY = '(min-width: 768px)' // matches Tailwind `md` breakpoint used below

// Layout changes coalesce for this long before hitting /api/profile. Anything
// still pending is flushed on unmount and on pagehide — see flushPrefs below.
const PERSIST_DEBOUNCE_MS = 500

function metaFor(id: BentoId) {
  const meta = BENTO_META[id]
  return { colSpan: meta.colSpan, minHeight: BENTO_HEIGHT[meta.height] }
}

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
  const pendingPrefsRef = useRef<{ order: string[]; collapsed: Record<string, boolean> } | null>(null)

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY)
    setIsDesktop(mql.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  // Sends whatever is pending right now, if anything. `keepalive` so the
  // request survives the document being torn down (pagehide); apiClient
  // spreads RequestInit straight into fetch.
  const flushPrefs = useCallback((opts?: { keepalive?: boolean }) => {
    if (persistDebounceRef.current) {
      clearTimeout(persistDebounceRef.current)
      persistDebounceRef.current = null
    }
    const pending = pendingPrefsRef.current
    if (pending === null) return null
    pendingPrefsRef.current = null

    return apiClient('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify({ ui_prefs: { bento_order: pending.order, bento_collapsed: pending.collapsed } }),
      keepalive: opts?.keepalive ?? false,
    })
  }, [])

  // A pending write must not be thrown away. The previous cleanup called
  // clearTimeout and nothing else, so collapsing a bento and navigating within
  // the debounce window silently lost the change. Flush instead of discard.
  useEffect(() => {
    const onPageHide = () => { flushPrefs({ keepalive: true })?.catch(() => { /* page is going away */ }) }
    window.addEventListener('pagehide', onPageHide)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      flushPrefs({ keepalive: true })?.catch(() => { /* unmounted */ })
    }
  }, [flushPrefs])

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
    pendingPrefsRef.current = { order, collapsed }
    if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current)
    persistDebounceRef.current = setTimeout(() => {
      // Was `.catch(() => {})`, which made a failed save look identical to a
      // slow one — to the user and to the e2e suite alike. Surface it so the
      // layout is not silently lost at the next reload.
      flushPrefs()?.catch(() => { toast.error(t('profile.layoutSaveError')) })
    }, PERSIST_DEBOUNCE_MS)
  }, [flushPrefs, t])

  // Mirrored into refs so the handlers below can read the latest values without
  // reaching for them inside a state updater. React updaters must be pure — it
  // may replay them — so persistPrefs (which mutates a ref and arms a timer)
  // must not run in there, even though it happens to be idempotent today.
  const bentoCollapsedRef = useRef(bentoCollapsed)
  useEffect(() => {
    bentoCollapsedRef.current = bentoCollapsed
  }, [bentoCollapsed])

  const bentoOrderRef = useRef(bentoOrder)
  useEffect(() => {
    bentoOrderRef.current = bentoOrder
  }, [bentoOrder])

  const handleReorder = useCallback((next: string[]) => {
    if (!layoutRestored) return
    setBentoOrder(next)
    persistPrefs(next, bentoCollapsedRef.current)
  }, [persistPrefs, layoutRestored])

  const toggleCollapse = useCallback((id: string) => {
    if (!layoutRestored) return
    const next = { ...bentoCollapsedRef.current, [id]: !bentoCollapsedRef.current[id] }
    setBentoCollapsed(next)
    persistPrefs(bentoOrderRef.current, next)
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
    persistPrefs(bentoOrderRef.current, next)
  }, [persistPrefs, layoutRestored])

  // Gated like handleReorder/toggleCollapse/toggleAll. Without this, a reset
  // clicked before useProfile() resolves persists DEFAULT_ORDER while the
  // restore effect above then overwrites local state with the saved order —
  // the user sees the old layout return and the DB disagrees until reload.
  const resetLayout = useCallback(() => {
    if (!layoutRestored) return
    setBentoOrder(DEFAULT_ORDER)
    setBentoCollapsed({})
    persistPrefs(DEFAULT_ORDER, {})
  }, [persistPrefs, layoutRestored])

  type BentoEntry = { colSpan: number; minHeight: number; node: React.ReactNode; cardStyle?: React.CSSProperties }

  // Incomplete-profile crimson border on PersonalDetailsContent's card: derived
  // here (not inside the content component, which no longer renders its own
  // card shell) via the same ['profile'] query the content component uses —
  // TanStack Query dedupes the request (docs/architecture/DECISIONS.md
  // Cross-Section Data Dependency Rule).
  const personalDetailsIncomplete = !!fullProfile && !fullProfile.first_name

  const bentoMap: Record<string, BentoEntry | null> = {
    [BENTO_IDS.PERSONAL_DETAILS]: {
      ...metaFor(BENTO_IDS.PERSONAL_DETAILS),
      node: <PersonalDetailsContent />,
      cardStyle: personalDetailsIncomplete ? { borderColor: 'var(--brand-crimson)' } : undefined,
    },
    [BENTO_IDS.ABO_INFO]: {
      ...metaFor(BENTO_IDS.ABO_INFO),
      node: <AboInfoContent />,
    },
    [BENTO_IDS.TRAVEL_DOC]: !isGuest ? {
      ...metaFor(BENTO_IDS.TRAVEL_DOC),
      node: <TravelDocContent />,
    } : null,
    [BENTO_IDS.SETTINGS]: {
      ...metaFor(BENTO_IDS.SETTINGS),
      node: <UserSettingsContent />,
    },
    [BENTO_IDS.TRIPS]: !isGuest ? {
      ...metaFor(BENTO_IDS.TRIPS),
      node: <TripsSection profileId={profileId} role={role} />,
    } : null,
    [BENTO_IDS.PAYMENTS]: !isGuest ? {
      ...metaFor(BENTO_IDS.PAYMENTS),
      node: <PaymentsSection profileId={profileId} role={role} />,
    } : null,
    [BENTO_IDS.EMAIL_PREFS]: !isGuest ? {
      ...metaFor(BENTO_IDS.EMAIL_PREFS),
      node: <EmailPrefsSection />,
    } : null,
    [BENTO_IDS.VITALS]: !isGuest ? {
      ...metaFor(BENTO_IDS.VITALS),
      node: <VitalsSection profileId={profileId} role={role} />,
    } : null,
    [BENTO_IDS.PARTICIPATION]: !isGuest ? {
      ...metaFor(BENTO_IDS.PARTICIPATION),
      node: <ParticipationSection profileId={profileId} role={role} />,
    } : null,
    [BENTO_IDS.CALENDAR]: {
      ...metaFor(BENTO_IDS.CALENDAR),
      node: <CalendarSection profileId={profileId} />,
    },
    [BENTO_IDS.STATS]: (aboNumber !== null || isCore) ? {
      ...metaFor(BENTO_IDS.STATS),
      node: <StatsSection role={role} aboNumber={aboNumber} />,
    } : null,
    [BENTO_IDS.INVITES]: hasInvites ? {
      ...metaFor(BENTO_IDS.INVITES),
      node: <InvitesBento />,
    } : null,
    [BENTO_IDS.ADMIN]: isAdmin ? {
      ...metaFor(BENTO_IDS.ADMIN),
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
          {/* Disabled until the saved layout is restored: these handlers all
              early-return before then, and a control that silently does
              nothing is worse than one that shows it is not ready yet. */}
          <button
            onClick={toggleAll}
            disabled={!layoutRestored}
            className="text-xs font-medium hover:opacity-70 transition-opacity disabled:opacity-40 disabled:cursor-default"
            style={{ color: 'var(--text-secondary)' }}
          >
            {allCollapsed ? t('profile.expandAll') : t('profile.collapseAll')}
          </button>
          <button
            onClick={resetLayout}
            disabled={!layoutRestored}
            className="text-xs font-medium hover:opacity-70 transition-opacity disabled:opacity-40 disabled:cursor-default"
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
            controlsDisabled={!layoutRestored}
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
                cardStyle={entry.cardStyle}
                controlsDisabled={!layoutRestored}
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
