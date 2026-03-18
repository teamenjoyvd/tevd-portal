import React from 'react'

// ── Types ──────────────────────────────────────────────────────────────────

type BentoGridProps = {
  children: React.ReactNode
  className?: string
}

// ── BentoGrid ──────────────────────────────────────────────────────────────

export default function BentoGrid({ children, className = '' }: BentoGridProps) {
  return (
    <div className="max-w-[1440px] mx-auto px-8 xl:px-12 2xl:px-16 overflow-x-hidden">
      <div className={`bento-grid ${className}`}>
        {children}
      </div>
    </div>
  )
}