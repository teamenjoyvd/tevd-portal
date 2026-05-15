'use client'

import { useState } from 'react'
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
import type { PayableItem } from '@/lib/types/items'

export function ItemStatusSection({ item }: { item: PayableItem }) {
  const [isActive, setIsActive] = useState(item.is_active)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function applyToggle(newValue: boolean) {
    setIsPending(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/payable-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newValue }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Failed to update status')
      }
      setIsActive(newValue)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
    >
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Status</h2>

      <div className="flex items-center gap-4">
        <span
          className="text-xs font-semibold px-3 py-1 rounded-full"
          style={{
            backgroundColor: isActive ? '#81b29a33' : 'rgba(0,0,0,0.06)',
            color: isActive ? '#2d6a4f' : 'var(--text-secondary)',
          }}
        >
          {isActive ? 'Active' : 'Inactive'}
        </span>

        {isActive ? (
          // Deactivating: show confirmation dialog
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                disabled={isPending}
                className="text-sm font-semibold px-4 py-2 rounded-xl border transition-colors hover:bg-black/5 disabled:opacity-40"
                style={{ borderColor: 'var(--border-default)', color: 'var(--brand-crimson)' }}
              >
                Deactivate
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Deactivate this item?</AlertDialogTitle>
                <AlertDialogDescription>
                  This item will no longer appear as a payment option for members. You can reactivate it at any time.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => applyToggle(false)}>
                  Deactivate
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          // Activating: no confirmation needed
          <button
            onClick={() => applyToggle(true)}
            disabled={isPending}
            className="text-sm font-semibold px-4 py-2 rounded-xl border transition-colors hover:bg-black/5 disabled:opacity-40"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
          >
            Activate
          </button>
        )}
      </div>

      {error && <p className="text-sm" style={{ color: 'var(--brand-crimson)' }}>{error}</p>}
    </div>
  )
}
