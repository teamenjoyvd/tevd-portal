'use client'

import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'

export function Closed() {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid var(--border-default)',
            color: 'var(--brand-crimson)',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Delete trip
        </button>
      </AlertDialogTrigger>
    </AlertDialog>
  )
}

export function Open() {
  return (
    <AlertDialog defaultOpen>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this trip?</AlertDialogTitle>
          <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
