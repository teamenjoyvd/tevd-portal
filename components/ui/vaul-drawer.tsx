'use client'

/**
 * vaul-drawer.tsx
 * Thin project wrapper around Vaul's Drawer primitives.
 * Styled to project CSS tokens. Not installed via shadcn CLI.
 *
 * Usage:
 *   import { VaulDrawer } from '@/components/ui/vaul-drawer'
 *   <VaulDrawer open={open} onClose={onClose}>
 *     {children}
 *   </VaulDrawer>
 *
 * No `snapPoints`: Vaul's fractional snap points measure against the
 * drawer's rendered content height, and for content shorter than the
 * snap fraction it leaves a stray translateY offset equal to the snap
 * height, parking the whole drawer below the viewport permanently
 * (data-state stays "open" but nothing is visible or clickable).
 * Content-sized (Vaul's default with no snapPoints) doesn't hit this;
 * `maxHeight` + EventPopup's own internal scroll area handle overflow.
 */

import { Drawer } from 'vaul'

export type VaulDrawerProps = {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

export function VaulDrawer({
  open,
  onClose,
  children,
}: VaulDrawerProps) {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={isOpen => { if (!isOpen) onClose() }}
    >
      <Drawer.Portal>
        <Drawer.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            zIndex: 49,
          }}
        />
        <Drawer.Content
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 'var(--radius) var(--radius) 0 0',
            backgroundColor: 'var(--bg-global)',
            boxShadow: '0 -4px 32px rgba(0,0,0,0.18)',
            outline: 'none',
            maxHeight: '92dvh',
          }}
        >
          {/* Drag handle — functional via Vaul, not decorative */}
          <div
            aria-hidden
            style={{
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'center',
              paddingTop: 12,
              paddingBottom: 4,
            }}
          >
            <div
              style={{
                width: 32,
                height: 4,
                borderRadius: 9999,
                backgroundColor: 'rgba(0,0,0,0.15)',
              }}
            />
          </div>
          {children}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
