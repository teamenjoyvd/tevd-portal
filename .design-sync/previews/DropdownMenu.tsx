'use client'

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

// Inlined rather than extracted to a helper component: asChild needs Radix
// to attach a ref to the actual DOM button for Popper anchor measurement — a
// plain function component silently drops that ref and the popper never gets
// a real anchor rect (it renders stuck at its internal placeholder position).
const avatarStyle = {
  width: 32,
  height: 32,
  borderRadius: 9999,
  backgroundColor: 'var(--brand-teal)',
  color: 'white',
  fontWeight: 700,
  fontSize: 12,
} as const

export function Closed() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button style={avatarStyle}>JD</button>
      </DropdownMenuTrigger>
    </DropdownMenu>
  )
}

export function Open() {
  return (
    <DropdownMenu open onOpenChange={() => {}}>
      <DropdownMenuTrigger asChild>
        <button style={avatarStyle}>JD</button>
      </DropdownMenuTrigger>
      {/* align="end" (the wrapper's default) anchors the trigger's real usage in a
          right-side nav bar — flipped to "start" here since the preview trigger
          sits near the frame's left edge. side="bottom" pins placement below the
          trigger — Radix's collision flip otherwise placed it above the trigger
          and off the top of this small preview viewport. */}
      <DropdownMenuContent align="start" side="bottom">
        <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
          Jamie Doe
        </div>
        <DropdownMenuSeparator style={{ height: 1, backgroundColor: 'var(--border-default)' }} />
        <DropdownMenuItem style={{ padding: '10px 16px', fontSize: 13, color: 'var(--text-primary)' }}>
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem style={{ padding: '10px 16px', fontSize: 13, color: 'var(--text-primary)' }}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
