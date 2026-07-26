'use client'

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Eyebrow } from '@/components/bento/BentoCard'

type BentoHeaderProps = {
  icon: LucideIcon
  title: string
  subtitle?: string
  action?: ReactNode
  tone?: 'crimson' | 'teal'
}

// Shared eyebrow header for all profile bentos. The responsive right gutter
// (pr-10 mobile, pr-20 desktop) clears the collapse/drag chrome anchored to
// the card's top-right corner — mobile hides the drag handle, so only the
// ~40px chevron needs clearing there.
export function BentoHeader({ icon: Icon, title, subtitle, action, tone = 'crimson' }: BentoHeaderProps) {
  const color = tone === 'teal' ? 'var(--brand-teal)' : 'var(--brand-crimson)'
  return (
    <div className="flex items-start justify-between mb-4 pr-10 md:pr-20">
      <div className="flex items-start gap-2 min-w-0">
        <Icon size={14} className="flex-shrink-0 mt-0.5" style={{ color }} />
        <div className="min-w-0">
          <Eyebrow style={{ color }}>{title}</Eyebrow>
          {subtitle && (
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}
