import type { ReactNode } from 'react'

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
}

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
}: AdminListCardProps) {
  return (
    <div
      draggable={!!grip}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className="rounded-2xl border flex items-center gap-3 px-4 py-3"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-default)',
        opacity: dragging ? 0.5 : 1,
      }}
    >
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
      <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
    </div>
  )
}
