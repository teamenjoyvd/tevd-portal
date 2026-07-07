'use client'

// SheetHeader is a bare flex div with no visible content of its own — it only
// renders meaningfully composed inside an open Sheet (same composition as
// the Sheet component's own preview; see .design-sync/previews/Sheet.tsx).
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'

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
