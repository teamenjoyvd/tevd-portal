'use client'

import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'

// Inlined rather than extracted to a helper component: asChild needs Radix
// to attach a ref to the actual DOM button for Popper anchor measurement — a
// plain function component silently drops that ref and the popper never gets
// a real anchor rect (it renders stuck at its internal placeholder position).
const avatarStyle = {
  width: 36,
  height: 36,
  borderRadius: 9999,
  backgroundColor: 'var(--brand-forest)',
  color: 'white',
  fontWeight: 700,
  fontSize: 13,
} as const

export function Closed() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button style={avatarStyle}>JD</button>
      </PopoverTrigger>
    </Popover>
  )
}

export function Open() {
  return (
    <Popover open onOpenChange={() => {}}>
      <PopoverTrigger asChild>
        <button style={avatarStyle}>JD</button>
      </PopoverTrigger>
      {/* align="end" (matching UserPopup.tsx's real usage) anchors a right-side
          nav trigger — flipped to "start" here since the preview trigger sits
          near the frame's left edge. side="bottom" pins placement below the
          trigger — Radix's collision flip otherwise placed it above the trigger
          and off the top of this small preview viewport. */}
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={8}
        style={{ minWidth: 180, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Jamie Doe</span>
        <button style={{ fontSize: 13, textAlign: 'left', color: 'var(--text-secondary)' }}>Sign out</button>
      </PopoverContent>
    </Popover>
  )
}
