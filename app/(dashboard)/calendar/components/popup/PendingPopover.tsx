'use client'

import { Info } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { PendingProfile } from './types'

export function PendingPopover({ profiles, color }: { profiles: PendingProfile[]; color: string }) {
  if (profiles.length === 0) return null
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0 hover:opacity-70 transition-opacity"
          style={{ color }}
          aria-label="View requesters"
        >
          <Info size={12} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        className="p-2 min-w-0 w-auto max-w-[200px]"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid rgba(0,0,0,0.08)' }}
      >
        <p className="text-[10px] font-semibold tracking-wider uppercase mb-1.5" style={{ color: 'var(--text-secondary)' }}>
          Requested by
        </p>
        <div className="space-y-0.5">
          {profiles.map((p) => {
            const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || '—'
            return (
              <p key={p.profile_id} className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                {name}
              </p>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
