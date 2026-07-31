'use client'

import type { ReactNode } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'

type AdminListCardProps = {
  grip?: boolean
  lead?: ReactNode
  title: string
  sub: string
  actions: ReactNode
  dragging?: boolean
  onDragStart?: () => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: () => void
  onDragEnd?: () => void
  /** Touch reorder — HTML5 drag never fires on touch, so mobile gets buttons. */
  onMoveUp?: () => void
  onMoveDown?: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
}

function GripIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      className="hidden sm:block flex-shrink-0"
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

export function AdminListCard({
  grip,
  lead,
  title,
  sub,
  actions,
  dragging,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: AdminListCardProps) {
  const { t } = useLanguage()
  const reorderable = onMoveUp != null || onMoveDown != null

  return (
    <div
      draggable={!!grip}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className="rounded-2xl border flex flex-col items-stretch gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-default)',
        opacity: dragging ? 0.5 : 1,
      }}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {grip && <GripIcon />}
        {lead != null && <div className="flex-shrink-0">{lead}</div>}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            {title}
          </p>
          <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {sub}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:flex-shrink-0">
        {reorderable && (
          <div className="flex items-center gap-1 sm:hidden">
            <MoveButton
              label={t('admin.content.reorder.moveUp')}
              disabled={canMoveUp === false}
              onClick={onMoveUp}
              d="M7 4.5 3 8.5h8L7 4.5Z"
            />
            <MoveButton
              label={t('admin.content.reorder.moveDown')}
              disabled={canMoveDown === false}
              onClick={onMoveDown}
              d="M7 9.5 11 5.5H3L7 9.5Z"
            />
          </div>
        )}
        {actions}
      </div>
    </div>
  )
}

function MoveButton({
  label,
  disabled,
  onClick,
  d,
}: {
  label: string
  disabled: boolean
  onClick?: () => void
  d: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="w-7 h-7 rounded-lg border flex items-center justify-center transition-colors disabled:opacity-30 hover:bg-black/5"
      style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
        <path d={d} />
      </svg>
    </button>
  )
}
