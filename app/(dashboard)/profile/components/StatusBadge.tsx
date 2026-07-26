'use client'

import * as React from 'react'

type StatusToken = 'success' | 'info' | 'alert' | 'pending' | 'neutral'

// Mirrors components/admin/StatusPill.tsx's token lookup, but the caller
// supplies the label — some callers render the raw status string verbatim
// and a badge-owned label would silently change that copy.
const STATUS_TOKEN_MAP: Record<string, StatusToken> = {
  approved:  'success',
  completed: 'success',
  confirmed: 'success',
  attended:  'success',
  valid:     'success',
  pending:   'pending',
  denied:    'alert',
  failed:    'alert',
  expired:   'alert',
  claimed:   'info',
  expiring:  'info',
  cancelled: 'neutral',
  revoked:   'neutral',
  // Identity entries — lets callers (e.g. EXPIRY_TOKEN in ../types.ts) pass an
  // already-resolved token name straight through instead of a raw status.
  success:   'success',
  info:      'info',
  alert:     'alert',
  neutral:   'neutral',
}

const DEFAULT_CLASSNAME = 'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold'

export function StatusBadge({
  status,
  children,
  className,
  style,
}: {
  status: string
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  const token = STATUS_TOKEN_MAP[status.toLowerCase()] ?? 'pending'
  return (
    <span
      className={className ?? DEFAULT_CLASSNAME}
      style={{
        backgroundColor: `var(--status-${token}-bg)`,
        color: `var(--status-${token}-fg)`,
        ...style,
      }}
    >
      {children}
    </span>
  )
}
