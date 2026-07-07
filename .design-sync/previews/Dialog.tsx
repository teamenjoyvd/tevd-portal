'use client'

import {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

export function Closed() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            backgroundColor: 'var(--brand-crimson)',
            color: 'white',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Open dialog
        </button>
      </DialogTrigger>
    </Dialog>
  )
}

export function Open() {
  return (
    <Dialog defaultOpen>
      <DialogPortal>
        {/* DialogOverlay ships with no background color of its own — every real
            call site in this repo passes one explicitly (see CalendarClient.tsx). */}
        <DialogOverlay style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} />
        <DialogContent
          style={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 380,
            padding: 24,
            borderRadius: 16,
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            boxShadow: '0 24px 48px rgba(0,0,0,0.18)',
          }}
        >
          <DialogHeader>
            <DialogTitle>Confirm departure change</DialogTitle>
            <DialogDescription>All travelers on this itinerary will be notified.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}
