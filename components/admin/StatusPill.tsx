'use client'

import * as React from 'react'

type StatusToken = 'success' | 'info' | 'alert' | 'pending'

export function StatusPill({ status }: { status: string }) {
  let token: StatusToken = 'pending'
  let label = 'Pending'

  switch (status) {
    case 'sent':
      token = 'success'
      label = 'Sent'
      break
    case 'claimed':
      token = 'info'
      label = 'Claimed'
      break
    case 'failed':
      token = 'alert'
      label = 'Failed'
      break
    case 'permanently_failed':
      token = 'alert'
      label = 'Permanently Failed'
      break
    case 'pending':
    default:
      token = 'pending'
      label = 'Pending'
      break
  }

  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: `var(--status-${token}-bg)`,
        color: `var(--status-${token}-fg)`,
      }}
    >
      {label}
    </span>
  )
}
