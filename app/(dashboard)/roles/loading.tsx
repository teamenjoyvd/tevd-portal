'use client'

import { Loader2 } from 'lucide-react'

export default function RolesLoading() {
  return (
    <div className="w-full min-h-[60vh] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--brand-forest)' }} />
    </div>
  )
}
