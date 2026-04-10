'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { formatDate } from '@/lib/format'

type RegistrationRow = {
  id: string
  created_at: string
  trip_id: string
  profile: {
    id: string
    first_name: string
    last_name: string
    abo_number: string | null
  }
  trip: {
    id: string
    title: string
    destination: string
    start_date: string
  }
}

function ApprovalHubContent({
  initialRegistrations,
}: {
  initialRegistrations: RegistrationRow[]
}) {
  const [registrations, setRegistrations] = useState<RegistrationRow[]>(initialRegistrations)

  const mutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'approved' | 'denied' }) => {
      const res = await fetch(`/api/admin/registrations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      return { id }
    },
    onSuccess: ({ id }) => {
      setRegistrations(prev => prev.filter(r => r.id !== id))
    },
  })

  if (registrations.length === 0) {
    return (
      <div
        className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
      >
        <div className="px-6 py-8">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            No pending trip registrations.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
    >
      <div className="px-6 pt-5 pb-2">
        <p
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--text-secondary)' }}
        >
          Pending Requests
        </p>
      </div>

      {registrations.map(r => {
        const isActing = mutation.isPending && mutation.variables?.id === r.id
        return (
          <div
            key={r.id}
            className="flex items-start justify-between gap-4 px-6 py-4 border-t"
            style={{ borderColor: 'var(--border-default)' }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {r.profile.first_name} {r.profile.last_name}
                {r.profile.abo_number && (
                  <span
                    className="ml-2 font-normal text-xs"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {r.profile.abo_number}
                  </span>
                )}
              </p>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {r.trip.title} — {r.trip.destination}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                Requested {formatDate(r.created_at)} · Trip starts {formatDate(r.trip.start_date)}
              </p>
            </div>

            <div className="flex gap-2 flex-shrink-0 pt-0.5">
              <button
                disabled={isActing}
                onClick={() => mutation.mutate({ id: r.id, status: 'approved' })}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#1a6b4a' }}
              >
                Approve
              </button>
              <button
                disabled={isActing}
                onClick={() => mutation.mutate({ id: r.id, status: 'denied' })}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-opacity hover:opacity-80"
                style={{
                  backgroundColor: 'var(--bg-global)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              >
                Deny
              </button>
            </div>
          </div>
        )
      })}

      {mutation.isError && (
        <div className="px-6 pb-4">
          <p className="text-xs" style={{ color: '#bc4749' }}>
            {(mutation.error as Error).message}
          </p>
        </div>
      )}
    </div>
  )
}

export function ApprovalHubClient({
  initialRegistrations,
}: {
  initialRegistrations: RegistrationRow[]
}) {
  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block">
        <ApprovalHubContent initialRegistrations={initialRegistrations} />
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        <ApprovalHubContent initialRegistrations={initialRegistrations} />
      </div>
    </>
  )
}
