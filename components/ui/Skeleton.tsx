import type { CSSProperties } from 'react'

export function Skeleton({
  className,
  style,
}: {
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      className={`animate-pulse${className ? ` ${className}` : ''}`}
      style={{ backgroundColor: 'var(--border-default)', ...style }}
    />
  )
}
