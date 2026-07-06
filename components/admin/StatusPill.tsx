'use client'

import * as React from 'react'

export function StatusPill({ status }: { status: string }) {
  let colors = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
  let label = 'Pending'

  switch (status) {
    case 'sent':
      colors = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      label = 'Sent'
      break
    case 'claimed':
      colors = 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      label = 'Claimed'
      break
    case 'failed':
      colors = 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
      label = 'Failed'
      break
    case 'permanently_failed':
      colors = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      label = 'Permanently Failed'
      break
    case 'pending':
    default:
      colors = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      label = 'Pending'
      break
  }

  return (
    <span className={[
      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
      colors,
    ].join(' ')}>
      {label}
    </span>
  )
}
