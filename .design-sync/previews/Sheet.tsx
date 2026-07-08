'use client'

import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'

export function Closed() {
  return (
    <Sheet>
      <SheetTrigger asChild>
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
          Edit itinerary
        </button>
      </SheetTrigger>
    </Sheet>
  )
}

export function Open() {
  return (
    <Sheet defaultOpen>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Edit itinerary</SheetTitle>
        </SheetHeader>
        <div style={{ padding: 24 }}>
          <SheetDescription>Update dates, travelers, and notes for this trip.</SheetDescription>
        </div>
      </SheetContent>
    </Sheet>
  )
}
