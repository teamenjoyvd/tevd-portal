import React, { forwardRef } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────

type CardVariant = 'default' | 'forest' | 'crimson' | 'teal' | 'edge-info' | 'edge-alert'

export type BentoCardProps = {
  children?: React.ReactNode
  variant?: CardVariant
  colSpan?: number
  mobileColSpan?: number
  rowSpan?: number
  className?: string
  style?: React.CSSProperties
  onClick?: React.MouseEventHandler<HTMLDivElement>
}

// ── Interactive class constant ─────────────────────────────────────────────────

export const BENTO_INTERACTIVE_CLASSES = 'interactive-lift active:scale-[0.98] transition-all'

// ── Eyebrow sub-component ────────────────────────────────────────────────────

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

// ── BentoCard ──────────────────────────────────────────────────────────────────

const BentoCard = forwardRef<HTMLDivElement, BentoCardProps>(function BentoCard({
  children,
  variant = 'default',
  colSpan,
  mobileColSpan = 12,
  rowSpan,
  className = '',
  style,
  onClick,
}, ref) {
  const variantClass =
    variant === 'default'     ? 'card' :
    variant === 'forest'      ? 'card card--forest' :
    variant === 'crimson'     ? 'card card--crimson' :
    variant === 'teal'        ? 'card card--teal' :
    variant === 'edge-info'   ? 'card card--edge-info' :
    variant === 'edge-alert'  ? 'card card--edge-alert' :
    'card'

  const spanStyle: React.CSSProperties = {
    '--col-span': colSpan ?? 12,
    '--mobile-col-span': mobileColSpan,
    gridColumn: 'span var(--col-span)',
    ...(rowSpan ? { gridRow: `span ${rowSpan}` } : {}),
  } as React.CSSProperties

  // Only apply lift animation when the card is interactive (has a click handler)
  const liftClass = onClick ? 'interactive-lift' : ''

  return (
    <div
      ref={ref}
      className={`${variantClass} ${liftClass} ${className}`.trim()}
      style={{ ...spanStyle, ...style }}
      onClick={onClick}
    >
      {children}
    </div>
  )
})

export default BentoCard
