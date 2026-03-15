'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

type Registration = {
  id: string
  status: 'pending' | 'approved' | 'denied'
  created_at: string
  trip_id: string
  profile: { id: string; first_name: string; last_name: string; abo_number: string | null }
}

type Trip = { id: string; title: string; destination: string; start_date: string }

export default function ApprovalHubPage() {
  const qc = useQueryClient()

  const { data: trips = [] } = useQuery<Trip[]>({
    queryKey: ['trips'],
    queryFn: () => fetch('/api/trips').then(r => r.json()),
  })

  const { data: registrations = [], isLoading } = useQuery<Registration[]>({
    queryKey: ['registrations', 'all'],
    queryFn: async () => {
      const results = await Promise.all(
        trips.map(t =>
          fetch(`/api/trips/${t.id}/registrations`).then(r => r.json())
        )
      )
      return results.flat()
    },
    enabled: trips.length > 0,
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'denied' }) =>
      fetch(`/api/admin/registrations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).then(r => r.json()),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['registrations', 'all'] })
      const prev = qc.getQueryData<Registration[]>(['registrations', 'all'])
      qc.setQueryData<Registration[]>(['registrations', 'all'], old =>
        old?.map(r => r.id === id ? { ...r, status } : r)
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['registrations', 'all'], ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['registrations', 'all'] }),
  })

  const tripTitle = (id: string) => trips.find(t => t.id === id)?.title ?? id

  const pending  = registrations.filter(r => r.status === 'pending')
  const resolved = registrations.filter(r => r.status !== 'pending')

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">Approval Hub</h1>
      <p className="text-sm text-gray-500 mb-8">
        Trip registrations and event role requests.
      </p>

      {/* Pending */}
      <section className="mb-10">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
          Pending — {pending.length}
        </h2>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : pending.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">Nothing pending.</p>
        ) : (
          <div className="space-y-2">
            {pending.map(r => (
              <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">
                    {r.profile.first_name} {r.profile.last_name}
                    {r.profile.abo_number && (
                      <span className="text-gray-400 font-normal ml-1">· {r.profile.abo_number}</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{tripTitle(r.trip_id)}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateStatus.mutate({ id: r.id, status: 'approved' })}
                    disabled={updateStatus.isPending}
                    className="px-4 py-1.5 rounded-lg bg-[#81b29a] text-white text-sm font-medium disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => updateStatus.mutate({ id: r.id, status: 'denied' })}
                    disabled={updateStatus.isPending}
                    className="px-4 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium disabled:opacity-50"
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Resolved */}
      {resolved.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
            Resolved — {resolved.length}
          </h2>
          <div className="space-y-2">
            {resolved.map(r => (
              <div key={r.id} className="bg-white border border-gray-100 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">
                    {r.profile.first_name} {r.profile.last_name}
                  </p>
                  <p className="text-xs text-gray-400">{tripTitle(r.trip_id)}</p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  r.status === 'approved'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700'
                }`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}