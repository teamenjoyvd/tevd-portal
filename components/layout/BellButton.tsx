'use client'

import { useState } from 'react'
import { useUnreadCount } from '@/lib/hooks/useNotifications'
import NotificationPopup from '@/components/notifications/NotificationPopup'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'

/**
 * Isolated client component so that useUnreadCount (→ useNotifications cache)
 * is always behind a <Suspense> boundary in Header.
 * Without this isolation, React 19 throws #310 on SSR-prerendered routes
 * because useQuery's internal useMemo runs during the prerender pass.
 */
export default function BellButton() {
  const unread = useUnreadCount()
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="interactive relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors"
          aria-label="Notifications"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
            stroke="var(--text-nav)" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {unread > 0 && (
            <span
              className="absolute top-0.5 right-0.5 min-w-[15px] h-[15px] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1"
              style={{ backgroundColor: 'var(--brand-crimson)' }}
            >
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <NotificationPopup onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}
