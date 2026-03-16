'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

type Props = {
  tripId: string
  profileId: string | null
}

type Toast = { message: string; type: 'success' | 'error' }

export default function RegisterButton({ tripId, profileId }: Props) {
  const qc = useQueryClient()
  const [toast, setToast] = useState<Toast | null>(null)

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const mutation = useMutation({
    mutationFn: () =>
      fetch(`/api/trips/${tripId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registrations'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      showToast('Registration submitted — awaiting approval.', 'success')
    },
    onError: (e: Error) => {
      const msg =
        e.message.toLowerCase().includes('already') ||
        e.message.toLowerCase().includes('unique')
          ? 'You are already registered for this trip.'
          : e.message
      showToast(msg, 'error')
    },
  })

  return (
    <div className="relative">
      {toast && (
        <div
          className="absolute bottom-full left-0 right-0 mb-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white text-center"
          style={{ backgroundColor: toast.type === 'success' ? 'var(--sage)' : 'var(--crimson)' }}
        >
          {toast.message}
        </div>
      )}
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || !profileId}
        className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 active:opacity-70 transition-opacity flex items-center justify-center gap-2"
        style={{ backgroundColor: 'var(--crimson)' }}
      >
        {mutation.isPending && (
          <svg
            className="animate-spin"
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
        )}
        {mutation.isPending ? 'Registering…' : 'Register for this trip'}
      </button>
    </div>
  )
}