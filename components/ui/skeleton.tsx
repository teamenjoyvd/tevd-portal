import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

export function Skeleton({
  className,
  style,
}: {
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      className={cn('skeleton-shimmer rounded-container', className)}
      style={{ backgroundColor: 'var(--skeleton-base)', ...style }}
    />
  )
}
