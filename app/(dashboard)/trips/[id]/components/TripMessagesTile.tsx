'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatDateTime } from '@/lib/format'

interface TripMessage {
  id: string
  body: string
  created_at: string
}

interface ApiError {
  status?: number
  message: string
}

export function TripMessagesTile({ tripId }: { tripId: string }) {
  const [retrying, setRetrying] = useState(false)

  const { data: messages, isLoading, isError, error, refetch } = useQuery<TripMessage[], ApiError>({
    queryKey: ['trip-messages', tripId],
    queryFn: () =>
      fetch(`/api/trips/${tripId}/messages`).then(async r => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}))
          const err: ApiError = { status: r.status, message: body.error ?? 'Failed' }
          throw err
        }
        return r.json()
      }),
    retry: false,
  })

  if (isLoading) return null

  // 403 = not an approved attendee — expected, render nothing
  if (isError && (error as ApiError)?.status === 403) return null

  // 5xx or network error — discreet retry, no alarming message
  if (isError) {
    return (
      <div
        className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
      >
        <div className="px-6 py-4 flex items-center justify-between">
          <p
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: 'var(--text-secondary)' }}
          >
            Trip Messages
          </p>
          <button
            onClick={async () => { setRetrying(true); await refetch(); setRetrying(false) }}
            disabled={retrying}
            className="text-xs hover:opacity-70 transition-opacity disabled:opacity-40"
            style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {retrying ? 'Retrying…' : '↺ Retry'}
          </button>
        </div>
      </div>
    )
  }

  if (!messages || messages.length === 0) return null

  // Newest-first
  const sorted = [...messages].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

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
          Trip Messages
        </p>
      </div>
      <div className="px-6 pb-5">
        <div className="space-y-1 mt-1">
          {sorted.map(m => (
            <div
              key={m.id}
              className="py-3 border-b last:border-0"
              style={{ borderColor: 'var(--border-default)' }}
            >
              <p
                className="text-sm"
                style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              >
                {m.body}
              </p>
              <p
                className="text-xs mt-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                {formatDateTime(m.created_at)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
