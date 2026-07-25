'use client'

import { forwardRef, type ReactNode } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { Button } from '@/components/ui/button'
import { BENTO_KEY_MAP } from './bento-registry'

// ── Drag handle ───────────────────────────────────────────────────────────────
// No @dnd-kit import here — this file is the mobile-path render, and the drag
// wiring (ref/attributes/listeners) is supplied by BentoGrid.tsx's dnd-kit
// wrapper so @dnd-kit/* stays out of this module's chunk.

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
}) {
  const { t } = useLanguage()

  const style: React.CSSProperties = {
    ...(disableDrag ? {} : { gridColumn: `span ${colSpan}` }),
    position: 'relative',
    // Mobile stack (disableDrag): no minHeight — cards size to their content
    minHeight: disableDrag || collapsed ? undefined : minHeight,
    ...dragStyle,
  }

  const bentoKey = BENTO_KEY_MAP[id]
  const label = bentoKey ? t(bentoKey) : id

  return (
    <div
      ref={cardRef}
      className={!disableDrag && colSpan === 6 ? 'bento-mobile-full' : ''}
      style={style}
    >
      {collapsed ? (
        <div
          className="rounded-2xl px-6 py-4 flex items-center justify-between"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
        >
          <div className="flex items-center gap-3">
            {!disableDrag && dragHandle}
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
        </div>
      ) : (
        <>
          <div style={{ position: 'absolute', top: 18, right: 16, display: 'flex', alignItems: 'center', gap: 6, zIndex: 10 }}>
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
          {/*
            Desktop: height 100% fills the grid cell (minHeight set on parent).
            Mobile (disableDrag): height auto — parent has no fixed height, so
            h-full children resolve to auto and the card sizes to its content.
          */}
          <div style={{ overflow: 'hidden', height: disableDrag ? 'auto' : '100%' }}>{children}</div>
        </>
      )}
    </div>
  )
}
