'use client'

import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { formatDate } from '@/lib/format'
import { BackButton, TripHeroImage, TripDetail } from './shared'
import type { Tables } from '@/types/supabase'
import type { TripProfile } from '../page'
import { apiClient } from '@/lib/apiClient'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'

type Trip = Tables<'trips'>
type Registration = Tables<'trip_registrations'>

const FALLBACK_ACCENT = '#2d6a4f'

export function PendingView({
  trip, profile, registration,
}: { trip: Trip; profile: TripProfile; registration: Registration }) {
  const router = useRouter()
  const [alertOpen, setAlertOpen] = useState(false)
  const [accentColor, setAccentColor] = useState(FALLBACK_ACCENT)

  const cancelMutation = useMutation({
    mutationFn: () =>
      apiClient(`/api/profile/trips/${trip.id}/cancel`, { method: 'POST' }),
    onSuccess: () => router.push('/trips'),
  })

  if (registration.cancelled_at) {
    return (
      <div className="py-8 pb-16">
        <div className="max-w-[720px] mx-auto px-4">
          <BackButton />
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
            <TripHeroImage trip={trip} onAccentColor={setAccentColor} />
            <TripDetail trip={trip} profile={profile} accentColor={accentColor} />
          </div>
          <div className="mt-4 rounded-2xl px-6 py-5"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Registration cancelled on {formatDate(registration.cancelled_at)}.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="py-8 pb-16">
      <div className="max-w-[720px] mx-auto px-4">
        <BackButton />
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
          <TripHeroImage trip={trip} onAccentColor={setAccentColor} />
          <TripDetail trip={trip} profile={profile} accentColor={accentColor} />
        </div>
        <div className="mt-4 rounded-2xl px-6 py-6"
          style={{ backgroundColor: 'rgba(180,138,60,0.08)', border: '1px solid rgba(180,138,60,0.25)' }}>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-0.5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="#b48a3c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold mb-1" style={{ color: '#b48a3c' }}>
                Registration Pending
              </p>
              <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
                Your registration request is awaiting admin approval.
              </p>
              <button
                onClick={() => setAlertOpen(true)}
                disabled={cancelMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50 transition-opacity hover:opacity-80"
                style={{ backgroundColor: 'var(--border-default)', color: 'var(--text-primary)' }}
              >
                Cancel Registration
              </button>
              {cancelMutation.isError && (
                <p className="text-xs mt-2" style={{ color: '#bc4749' }}>
                  {(cancelMutation.error as Error).message}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={alertOpen} onOpenChange={open => { if (!open) setAlertOpen(false) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel registration?</AlertDialogTitle>
            <AlertDialogDescription>
              This will withdraw your registration for &ldquo;{trip.title}&rdquo;. You can re-register later if the trip is still open.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep registration</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'Cancelling…' : 'Yes, cancel'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
