'use client'

/**
 * vaul-drawer.tsx
 * Thin project wrapper around Vaul's Drawer primitives.
 * Styled to project CSS tokens. Not installed via shadcn CLI.
 *
 * Usage:
 *   import { VaulDrawer } from '@/components/ui/vaul-drawer'
 *   <VaulDrawer open={open} onClose={onClose} snapPoints={[0.5, 0.92]}>
 *     {children}
 *   </VaulDrawer>
 */

import { Drawer } from 'vaul'

export type VaulDrawerProps = {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  snapPoints?: (number | string)[]
  fadeFromIndex?: number
}

export function VaulDrawer({
  open,
  onClose,
  children,
  snapPoints = [0.5, 0.92],
  fadeFromIndex = 1,
}: VaulDrawerProps) {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={isOpen => { if (!isOpen) onClose() }}
      snapPoints={snapPoints}
      fadeFromIndex={fadeFromIndex}
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
            borderRadius: '1rem 1rem 0 0',
            backgroundColor: 'var(--bg-global)',
            boxShadow: '0 -4px 32px rgba(0,0,0,0.18)',
            outline: 'none',
            // Height is controlled by Vaul via snapPoints
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
