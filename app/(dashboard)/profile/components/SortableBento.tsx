'use client'

import { forwardRef, type ReactNode } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { Button } from '@/components/ui/button'
import BentoCard from '@/components/bento/BentoCard'
import { BENTO_KEY_MAP, BENTO_ICON_MAP, type BentoId } from './bento-registry'

// ── Drag handle ───────────────────────────────────────────────────────────────
// No @dnd-kit import here — this file is also the mobile-path render, and the
// drag wiring (ref/attributes/listeners) is supplied by BentoGrid.tsx's
// dnd-kit wrapper so @dnd-kit/* stays out of this module's chunk.

function GripIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      className="flex-shrink-0"
      style={{ color: 'var(--text-secondary)', cursor: 'grab' }}
    >
      <circle cx="4" cy="3" r="1.2" fill="currentColor" />
      <circle cx="4" cy="7" r="1.2" fill="currentColor" />
      <circle cx="4" cy="11" r="1.2" fill="currentColor" />
      <circle cx="10" cy="3" r="1.2" fill="currentColor" />
      <circle cx="10" cy="7" r="1.2" fill="currentColor" />
      <circle cx="10" cy="11" r="1.2" fill="currentColor" />
    </svg>
  )
}

export const DragHandle = forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  function DragHandle(props, ref) {
    return (
      <span
        {...props}
        ref={ref}
        title="Drag to reorder"
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 44, cursor: 'grab', touchAction: 'none', userSelect: 'none', opacity: 0.5, flexShrink: 0 }}
      >
        <GripIcon />
      </span>
    )
  }
)

// ── SortableBento ─────────────────────────────────────────────────────────────
// The bento is a grid cell, a drag target and a card all in one element now
// that BentoCard forwards refs — no separate outer div contributing only a
// class name. Headers/skeletons/empty-states inside `children` migrate to
// the shared BentoHeader/BentoSkeleton/BentoEmpty components separately.

export function SortableBento({
  id,
  collapsed,
  onToggleCollapse,
  colSpan,
  minHeight,
  disableDrag,
  children,
  cardRef,
  dragStyle,
  dragHandle,
  cardStyle,
}: {
  id: string
  collapsed: boolean
  onToggleCollapse: () => void
  colSpan: number
  minHeight: number
  disableDrag?: boolean
  children: ReactNode
  // Drag wiring — supplied only by BentoGrid.tsx's dnd-kit wrapper (desktop path).
  cardRef?: (node: HTMLDivElement | null) => void
  dragStyle?: React.CSSProperties
  dragHandle?: ReactNode
  // Per-bento style override (e.g. PersonalDetailsContent's incomplete-profile
  // crimson border) — sourced from ProfileClient's bentoMap, not from inside
  // the content component, since content no longer renders its own card shell.
  cardStyle?: React.CSSProperties
}) {
  const { t } = useLanguage()

  const bentoKey = BENTO_KEY_MAP[id]
  const label = bentoKey ? t(bentoKey) : id
  const Icon = BENTO_ICON_MAP[id as BentoId] as typeof BENTO_ICON_MAP[BentoId] | undefined

  if (collapsed) {
    return (
      <BentoCard
        ref={cardRef}
        colSpan={colSpan}
        className="flex items-center justify-between"
        style={{ paddingTop: 12, paddingBottom: 12, ...dragStyle, ...cardStyle }}
      >
        <div className="flex items-center gap-3">
          {!disableDrag && dragHandle}
          {Icon && <Icon size={14} style={{ color: 'var(--text-secondary)', opacity: 0.6, flexShrink: 0 }} />}
          <span className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: 'var(--text-secondary)' }}>
            {label}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          title={t('profile.bento.expand')}
          aria-label={t('profile.bento.expand')}
          style={{ fontSize: 12, lineHeight: 1, opacity: 0.5, flexShrink: 0 }}
        >
          ▸
        </Button>
      </BentoCard>
    )
  }

  return (
    <BentoCard
      ref={cardRef}
      colSpan={colSpan}
      className="flex flex-col relative overflow-hidden"
      style={{
        // Mobile stack (disableDrag): no minHeight — cards size to their content
        minHeight: disableDrag ? undefined : minHeight,
        ...dragStyle,
        ...cardStyle,
      }}
    >
      <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', alignItems: 'center', gap: 6, zIndex: 10 }}>
        {!disableDrag && dragHandle}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          title={t('profile.bento.collapse')}
          aria-label={t('profile.bento.collapse')}
          style={{ fontSize: 12, lineHeight: 1, opacity: 0.5, flexShrink: 0 }}
        >
          ▾
        </Button>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </BentoCard>
  )
}
