'use client'

import { forwardRef, type ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ── Drag handle ───────────────────────────────────────────────────────────────

const DragHandle = forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  function DragHandle(props, ref) {
    return (
      <span
        {...props}
        ref={ref}
        title="Drag to reorder"
        style={{ cursor: 'grab', touchAction: 'none', userSelect: 'none', fontSize: 14, lineHeight: 1, color: 'var(--text-secondary)', opacity: 0.5, flexShrink: 0 }}
      >
        ⠇
      </span>
    )
  }
)

// ── Bento label map ───────────────────────────────────────────────────────────

const BENTO_LABELS: Record<string, string> = {
  'personal-details': 'Personal Details',
  'abo-info':         'ABO Information',
  'travel-doc':       'Travel Document',
  'settings':         'Settings',
  'trips':            'Trips',
  'payments':         'Payments',
  'email_prefs':      'Email Notifications',
  'vitals':           'Vital Signs',
  'participation':    'Participation',
  'calendar':         'Calendar',
  'stats':            'Stats',
  'admin':            'Admin Tools',
}

// ── SortableBento ─────────────────────────────────────────────────────────────

export function SortableBento({
  id,
  collapsed,
  onToggleCollapse,
  colSpan,
  minHeight,
  children,
}: {
  id: string
  collapsed: boolean
  onToggleCollapse: () => void
  colSpan: number
  minHeight: number
  children: ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style: React.CSSProperties = {
    gridColumn: `span ${colSpan}`,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    minHeight: collapsed ? undefined : minHeight,
  }

  return (
    <div
      ref={setNodeRef}
      className={colSpan === 6 ? 'bento-mobile-full' : ''}
      style={style}
    >
      {collapsed ? (
        <div
          className="rounded-2xl px-6 py-4 flex items-center justify-between"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
        >
          <div className="flex items-center gap-3">
            <DragHandle ref={setActivatorNodeRef} {...attributes} {...listeners} />
            <span className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: 'var(--text-secondary)' }}>
              {BENTO_LABELS[id] ?? id}
            </span>
          </div>
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Expand"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, lineHeight: 1, color: 'var(--text-secondary)', opacity: 0.5, flexShrink: 0 }}
          >
            ▸
          </button>
        </div>
      ) : (
        <>
          <div style={{ position: 'absolute', top: 18, right: 16, display: 'flex', alignItems: 'center', gap: 6, zIndex: 10 }}>
            <DragHandle ref={setActivatorNodeRef} {...attributes} {...listeners} />
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Collapse"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, lineHeight: 1, color: 'var(--text-secondary)', opacity: 0.5, flexShrink: 0 }}
            >
              ▾
            </button>
          </div>
          <div style={{ overflow: 'hidden', height: '100%' }}>{children}</div>
        </>
      )}
    </div>
  )
}
