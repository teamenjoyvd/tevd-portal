'use client'

import { forwardRef, type ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { type TranslationKey } from '@/lib/i18n/translations'

// ── Drag handle ───────────────────────────────────────────────────────────────

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

const DragHandle = forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
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

// ── Bento id → i18n key map ───────────────────────────────────────────────────

const BENTO_KEY_MAP: Record<string, TranslationKey> = {
  'personal-details': 'profile.bento.personalDetails',
  'abo-info':         'profile.bento.aboInfo',
  'travel-doc':       'profile.bento.travelDoc',
  'settings':         'profile.bento.settings',
  'trips':            'profile.bento.trips',
  'payments':         'profile.bento.payments',
  'email_prefs':      'profile.bento.emailPrefs',
  'vitals':           'profile.bento.vitals',
  'participation':    'profile.bento.participation',
  'calendar':         'profile.bento.calendar',
  'stats':            'profile.bento.stats',
  'admin':            'profile.bento.admin',
}

// ── SortableBento ─────────────────────────────────────────────────────────────

export function SortableBento({
  id,
  collapsed,
  onToggleCollapse,
  colSpan,
  minHeight,
  disableDrag,
  children,
}: {
  id: string
  collapsed: boolean
  onToggleCollapse: () => void
  colSpan: number
  minHeight: number
  disableDrag?: boolean
  children: ReactNode
}) {
  const { t } = useLanguage()

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: disableDrag })

  const style: React.CSSProperties = {
    ...(disableDrag ? {} : { gridColumn: `span ${colSpan}` }),
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    // Mobile stack (disableDrag): no minHeight — cards size to their content
    minHeight: disableDrag || collapsed ? undefined : minHeight,
  }

  const bentoKey = BENTO_KEY_MAP[id]
  const label = bentoKey ? t(bentoKey) : id

  return (
    <div
      ref={setNodeRef}
      className={!disableDrag && colSpan === 6 ? 'bento-mobile-full' : ''}
      style={style}
    >
      {collapsed ? (
        <div
          className="rounded-2xl px-6 py-4 flex items-center justify-between"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
        >
          <div className="flex items-center gap-3">
            {!disableDrag && (
              <DragHandle ref={setActivatorNodeRef} {...attributes} {...listeners} />
            )}
            <span className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: 'var(--text-secondary)' }}>
              {label}
            </span>
          </div>
          <button
            type="button"
            onClick={onToggleCollapse}
            title={t('profile.bento.expand')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, lineHeight: 1, color: 'var(--text-secondary)', opacity: 0.5, flexShrink: 0 }}
          >
            ▸
          </button>
        </div>
      ) : (
        <>
          <div style={{ position: 'absolute', top: 18, right: 16, display: 'flex', alignItems: 'center', gap: 6, zIndex: 10 }}>
            {!disableDrag && (
              <DragHandle ref={setActivatorNodeRef} {...attributes} {...listeners} />
            )}
            <button
              type="button"
              onClick={onToggleCollapse}
              title={t('profile.bento.collapse')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, lineHeight: 1, color: 'var(--text-secondary)', opacity: 0.5, flexShrink: 0 }}
            >
              ▾
            </button>
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
