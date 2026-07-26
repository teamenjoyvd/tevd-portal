'use client'

import { Skeleton } from '@/components/ui/skeleton'

// Body-only loading state — the card shell and BentoHeader stay mounted
// above this, so a loading bento never disappears then pops back.
export function BentoSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-4" style={{ width: i === rows - 1 ? '60%' : '100%' }} />
      ))}
    </div>
  )
}
