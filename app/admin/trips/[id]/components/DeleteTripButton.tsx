'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export function DeleteTripButton({ tripId }: { tripId: string }) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  async function handleDelete() {
    if (isPending) return
    setIsPending(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/trips/${tripId}`, { method: 'DELETE' })
      if (res.status === 204) {
        router.push('/admin/trips')
        return
      }
      const json = await res.json()
      if (res.status === 409 && json.error === 'has_dependents') {
        const parts: string[] = []
        if (json.registrations > 0) parts.push(`${json.registrations} registration${json.registrations !== 1 ? 's' : ''}`)
        if (json.payments > 0) parts.push(`${json.payments} payment${json.payments !== 1 ? 's' : ''}`)
        if (json.attachments > 0) parts.push(`${json.attachments} attachment${json.attachments !== 1 ? 's' : ''}`)
        if (json.messages > 0) parts.push(`${json.messages} message${json.messages !== 1 ? 's' : ''}`)
        setError(`Cannot delete: this trip has ${parts.join(', ')} attached. Remove them first.`)
      } else {
        setError(json.error ?? 'Failed to delete trip')
      }
      setOpen(false)
    } catch {
      setError('Failed to delete trip')
      setOpen(false)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="space-y-2">
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <button
            disabled={isPending}
            className="text-sm font-semibold px-4 py-2 rounded-xl border transition-colors hover:bg-black/5 disabled:opacity-40"
            style={{ borderColor: 'var(--brand-crimson)', color: 'var(--brand-crimson)' }}
          >
            {isPending ? 'Deleting…' : 'Delete Trip'}
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this trip?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {error && (
        <p className="text-sm" style={{ color: 'var(--brand-crimson)' }}>{error}</p>
      )}
    </div>
  )
}
