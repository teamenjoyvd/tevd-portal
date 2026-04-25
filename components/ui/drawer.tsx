"use client"

// SEQ267: Drawer is now a thin wrapper around shadcn Sheet.
// The external API (open, onClose, title, children) is preserved exactly —
// all call sites continue to import { Drawer } from '@/components/ui/Drawer'
// with zero changes required at each consumer.
// SEQ373: SheetContent widened to sm:max-w-2xl (672px) on desktop to
// accommodate GuideForm's two-column grid layouts comfortably.

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet"

type DrawerProps = {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export function Drawer({ open, onClose, title, children }: DrawerProps) {
  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <SheetContent side="right" className="sm:max-w-2xl w-full">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetClose asChild>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-black/8"
              style={{ color: "var(--text-secondary)" }}
              aria-label="Close"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </SheetClose>
        </SheetHeader>
        {/* Scrollable content — matches original Drawer behaviour */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}
