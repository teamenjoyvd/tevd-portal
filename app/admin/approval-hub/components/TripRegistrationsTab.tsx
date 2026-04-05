'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast'

// ── Types ────────────────────────────────────────────────────────

export type Trip = { id: string; title: string; destination: string; start_date: string }

export type TripRegistration = {
  id: string
  status: 'pending' | 'approved' | 'denied'
  created_at: string
  trip_id: string
  profile: { id: string; first_name: string; last_name: string; abo_number: string | null } | null
}

// ── Helpers ──────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  pending:  'bg-[#f2cc8f]/30 text-[#7a5c00] border border-[#f2cc8f]',
  approved: 'bg-[#81b29a]/20 text-[#2d6a4f] border border-[#81b29a]/50',
  denied:   'bg-[#bc4749]/10 text-[#bc4749] border border-[#bc4749]/30',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function CollapsibleResolved({ children, count }: { children: React.ReactNode; count: number }) {
  const [open, setOpen] = useState(false)
  if (count === 0) return null
  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase mb-3 hover:opacity-70 transition-opacity"
        style={{ color: 'var(--text-secondary)' }}
      >
        <span>Resolved — {count}</span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && <div className="space-y-2">{children}</div>}
    </div>
  )
}

// ── Component: Trip Registrations ──────────────────────────────────

export function TripRegistrationsTab() {
  const qc = useQueryClient()
  const [filterTripId, setFilterTripId] = useState<string>('all')

  const { data: trips = [] } = useQuery<Trip[]>({
    queryKey: ['trips'],
    queryFn: () => fetch('/api/trips').then(r => r.json()),
  })

  const { data: registrations = [], isLoading } = useQuery<TripRegistration[]>({
    queryKey: ['registrations', 'all'],
    queryFn: async () => {
      const results = await Promise.all(
        trips.map(t => fetch(`/api/trips/${t.id}/registrations`).then(r => r.json()))
      )
      return results.flat().filter((r): r is TripRegistration => !r.error)
    },
    enabled: trips.length > 0,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'denied' }) =>
      fetch(`/api/admin/registrations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).then(r => r.json()),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['registrations', 'all'] })
      const prev = qc.getQueryData<TripRegistration[]>(['registrations', 'all'])
      qc.setQueryData<TripRegistration[]>(['registrations', 'all'], old =>
        old?.map(r => r.id === id ? { ...r, status } : r)
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['registrations', 'all'], ctx.prev)
      toast.error('Failed to update registration. Please try again.')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['registrations', 'all'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const filtered = filterTripId === 'all'
    ? registrations
    : registrations.filter(r => r.trip_id === filterTripId)

  const pending  = filtered.filter(r => r.status === 'pending')
  const resolved = filtered.filter(r => r.status !== 'pending')
  const tripTitle = (id: string) => trips.find(t => t.id === id)?.title ?? id

  return (
    <div>
      {trips.length > 1 && (
        <div className="flex gap-2 flex-wrap mb-5">
          <button
            onClick={() => setFilterTripId('all')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              backgroundColor: filterTripId === 'all' ? 'var(--text-primary)' : 'rgba(0,0,0,0.05)',
              color: filterTripId === 'all' ? 'white' : 'var(--text-secondary)',
            }}
          >
            All trips
          </button>
          {trips.map(t => (
            <button
              key={t.id}
              onClick={() => setFilterTripId(t.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                backgroundColor: filterTripId === t.id ? 'var(--text-primary)' : 'rgba(0,0,0,0.05)',
                color: filterTripId === t.id ? 'white' : 'var(--text-secondary)',
              }}
            >
              {t.title}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>
        Pending — {pending.length}
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-black/5 rounded-xl animate-pulse" />)}
        </div>
      ) : pending.length === 0 ? (
        <div className="rounded-xl border px-5 py-8 text-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No pending registrations.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pending.map(r => (
            <div key={r.id} className="rounded-xl border px-4 py-3.5 flex items-center gap-3" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {r.profile?.first_name} {r.profile?.last_name}
                  {r.profile?.abo_number && (
                    <span className="font-normal text-xs ml-1.5" style={{ color: 'var(--text-secondary)' }}>
                      {r.profile.abo_number}
                    </span>
                  )}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {tripTitle(r.trip_id)} · {formatDate(r.created_at)}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => updateMutation.mutate({ id: r.id, status: 'approved' })}
                  disabled={updateMutation.isPending}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-opacity"
                  style={{ backgroundColor: 'var(--brand-teal)' }}
                >
                  Approve
                </button>
                <button
                  onClick={() => updateMutation.mutate({ id: r.id, status: 'denied' })}
                  disabled={updateMutation.isPending}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-opacity"
                  style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--text-primary)' }}
                >
                  Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CollapsibleResolved count={resolved.length}>
        {resolved.map(r => (
          <div key={r.id} className="rounded-xl border px-4 py-3 flex items-center justify-between gap-3" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="min-w-0">
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                {r.profile?.first_name} {r.profile?.last_name}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {tripTitle(r.trip_id)}
              </p>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${STATUS_BADGE[r.status]}`}>
              {r.status}
            </span>
          </div>
        ))}
      </CollapsibleResolved>
    </div>
  )
}
