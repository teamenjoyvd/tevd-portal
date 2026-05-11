'use client'

import { useQuery } from '@tanstack/react-query'
import type { EventLogEntry } from '@/app/api/admin/event-log/route'

// ── Helpers ────────────────────────────────────────────────────────────────

const EVENT_LABEL: Record<string, string> = {
  abo_verified:       'ABO Verified',
  abo_verify_failed:  'Verification Failed',
  clerk_sync_failed:  'Clerk Sync Failed',
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  ok:      { bg: 'rgba(129,178,154,0.2)', color: '#2d6a4f' },
  failed:  { bg: 'rgba(188,71,73,0.1)',   color: '#bc4749' },
  error:   { bg: 'rgba(188,71,73,0.1)',   color: '#bc4749' },
}

function formatTs(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Component ────────────────────────────────────────────────────────────────

export function AboVerificationTab() {
  const { data: entries = [], isLoading } = useQuery<EventLogEntry[]>({
    queryKey: ['admin-event-log'],
    queryFn: () => fetch('/api/admin/event-log').then(r => {
      if (!r.ok) throw new Error(r.statusText)
      return r.json()
    }),
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--border-default)' }} />
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        No verification events recorded yet.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>
        Verification Event Log
      </p>
      {entries.map(entry => {
        const statusStyle = STATUS_STYLE[entry.status] ?? STATUS_STYLE.failed
        const label = EVENT_LABEL[entry.event_type] ?? entry.event_type
        const claimedAbo = typeof entry.payload.claimed_abo === 'string' ? entry.payload.claimed_abo : null
        const claimedUpline = typeof entry.payload.claimed_upline_abo === 'string' ? entry.payload.claimed_upline_abo : null

        return (
          <div
            key={entry.id}
            className="rounded-xl border px-4 py-3"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {entry.subject_name && (
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {entry.subject_name}
                    </p>
                  )}
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={statusStyle}
                  >
                    {label}
                  </span>
                </div>
                {(claimedAbo || claimedUpline) && (
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {claimedAbo && (
                      <>ABO <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{claimedAbo}</span>{claimedUpline ? ' · ' : ''}</>
                    )}
                    {claimedUpline && (
                      <>Upline <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{claimedUpline}</span></>
                    )}
                  </p>
                )}
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {formatTs(entry.created_at)}
                </p>
              </div>
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                style={statusStyle}
              >
                {entry.status}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Tombstone exports ────────────────────────────────────────────────────────────
// page.tsx imports AdminMembersResponse from this file. Export a minimal
// shape compatible with the badge calculation (pending_verifications array).
// Badge is now always 0 since pending_verifications is not fetched.
export type AdminMembersResponse = {
  pending_verifications: never[]
}
