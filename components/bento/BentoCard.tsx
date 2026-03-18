import React from 'react'

// ── Types ──────────────────────────────────────────────────────────────────

type CardVariant = 'default' | 'forest' | 'crimson' | 'teal' | 'edge-info' | 'edge-alert'

type BentoCardProps = {
  children: React.ReactNode
  variant?: CardVariant
  colSpan?: number
  rowSpan?: number
  fullWidthMobile?: boolean
  halfWidthMobile?: boolean
  className?: string
  style?: React.CSSProperties
}

// ── KPI sub-component ──────────────────────────────────────────────────────

export function KpiValue({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-4xl font-medium tracking-tight tabular-nums"
      style={{ color: 'var(--text-primary)' }}
    >
      {children}
    </p>
  )
}

// ── Eyebrow sub-component ──────────────────────────────────────────────────

export function Eyebrow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p
      className="text-[11px] font-semibold tracking-[0.25em] uppercase"
      style={{ color: 'var(--brand-crimson)', ...style }}
    >
      {children}
    </p>
  )
}

// ── BentoCard ──────────────────────────────────────────────────────────────

export default function BentoCard({
  children,
  variant = 'default',
  colSpan,
  rowSpan,
  fullWidthMobile = false,
  halfWidthMobile = false,
  className = '',
  style,
}: BentoCardProps) {
  const variantClass =
    variant === 'default'     ? 'card' :
    variant === 'forest'      ? 'card card--forest' :
    variant === 'crimson'     ? 'card card--crimson' :
    variant === 'teal'        ? 'card card--teal' :
    variant === 'edge-info'   ? 'card card--edge-info' :
    variant === 'edge-alert'  ? 'card card--edge-alert' :
    'card'

  const spanStyle: React.CSSProperties = {}
  if (colSpan) spanStyle.gridColumn = `span ${colSpan}`
  if (rowSpan)  spanStyle.gridRow    = `span ${rowSpan}`

  const mobileClass = fullWidthMobile ? ' bento-mobile-full' : halfWidthMobile ? ' bento-mobile-half' : ''

  return (
  <div className={`${variantClass}${mobileClass} ${className}`} style={{ ...spanStyle, ...style }}>
      {children}
    </div>
  )
}