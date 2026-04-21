import React from 'react'

// ── Types ──────────────────────────────────────────────────────────────────

type BentoGridProps = {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

// ── BentoGrid ──────────────────────────────────────────────────────────────

export default function BentoGrid({ children, className = '', style }: BentoGridProps) {
  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 xl:px-8 overflow-x-hidden">
      <div className={`bento-grid ${className}`} style={style}>
        {children}
      </div>
    </div>
  )
}
