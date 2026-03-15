'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'

type MemberDetail = {
  profile: {
    id: string; first_name: string; last_name: string
    abo_number: string | null; role: string
    document_active_type: 'id' | 'passport'
    id_number: string | null; passport_number: string | null
    valid_through: string | null; created_at: string
    tree_nodes: { path: string; depth: number }[] | null
  }
  los: Record<string, unknown> | null
  registrations: {
    id: string; status: string; created_at: string
    trip: { title: string; destination: string; start_date: string }
  }[]
  payments: {
    id: string; amount: number; transaction_date: string
    status: string; note: string | null
    trip: { title: string }
  }[]
  roleRequests: {
    id: string; role_label: string; status: string; created_at: string
    event: { title: string; start_time: string }
  }[]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatEur(n: number) {
  return new Intl.NumberFormat('en-DE', { style: 'currency', currency: 'EUR' }).format(n)
}

function getExpiryState(v: string | null) {
  if (!v) return null
  const diff = (new Date(v).getTime() - Date.now()) / 86400000
  if (diff < 0) return 'critical'
  if (diff < 90) return 'critical'
  if (diff < 180) return 'warning'
  return 'ok'
}

const STATUS_PILL: Record<string, string> = {
  pending:   'bg-[#f2cc8f33] text-[#7a5c00]',
  approved:  'bg-[#81b29a33] text-[#2d6a4f]',
  denied:    'bg-[#bc474920] text-[#bc4749]',
  completed: 'bg-[#81b29a33] text-[#2d6a4f]',
  failed:    'bg-[#bc474920] text-[#bc4749]',
}

const ROLES: Array<'admin' | 'core' | 'member' | 'guest'> = ['admin', 'core', 'member', 'guest']

const LOS_KEYS = [
  ['gpv', 'GPV'], ['ppv', 'PPV'], ['gbv', 'GBV'],
  ['bonus_percent', 'Bonus %'], ['group_size', 'Group size'],
  ['qualified_legs', 'Qualified legs'], ['customers', 'Customers'],
  ['annual_ppv', 'Annual PPV'], ['sponsoring', 'Sponsoring'],
]

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()
  const [editRole, setEditRole] = useState(false)
  const [selectedRole, setSelectedRole] = useState<string>('')

  const { data, isLoading } = useQuery<MemberDetail>({
    queryKey: ['admin-member', id],
    queryFn: () => fetch(`/api/admin/members/${id}`).then(r => r.json()),
  })

  const updateMutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      fetch(`/api/admin/members/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-member', id] })
      qc.invalidateQueries({ queryKey: ['admin-members'] })
      setEditRole(false)
    },
  })

  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-2xl animate-pulse"
            style={{ backgroundColor: 'rgba(0,0,0,0.05)' }} />
        ))}
      </div>
    )
  }

  if (!data?.profile) return null
  const { profile, los, registrations, payments, roleRequests } = data

  const expiry = getExpiryState(profile.valid_through)
  const docNumber = profile.document_active_type === 'passport'
    ? profile.passport_number
    : profile.id_number

  const totalPaid = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0)

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm mb-6 hover:opacity-70 transition-opacity"
        style={{ color: 'var(--stone)' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Members
      </button>

      {/* Identity card */}
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 mb-4">
        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0"
            style={{ backgroundColor: 'var(--eggshell)', color: 'var(--deep)' }}
          >
            {profile.first_name[0]}{profile.last_name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-2xl font-semibold" style={{ color: 'var(--deep)' }}>
              {profile.first_name} {profile.last_name}
            </h1>
            <p className="text-sm" style={{ color: 'var(--stone)' }}>
              ABO: <span className="font-medium" style={{ color: 'var(--deep)' }}>
                {profile.abo_number ?? '—'}
              </span>
              {profile.tree_nodes?.[0] && (
                <> · Depth {profile.tree_nodes[0].depth}</>
              )}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--stone)' }}>
              Member since {formatDate(profile.created_at)}
            </p>
          </div>
        </div>

        {/* Role editor */}
        <div className="mt-4 pt-4 border-t border-black/5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: 'var(--stone)' }}>
              Role
            </p>
            {!editRole ? (
              <button
                onClick={() => { setEditRole(true); setSelectedRole(profile.role) }}
                className="text-xs font-medium"
                style={{ color: 'var(--crimson)' }}
              >
                Edit
              </button>
            ) : (
              <button
                onClick={() => setEditRole(false)}
                className="text-xs" style={{ color: 'var(--stone)' }}
              >
                Cancel
              </button>
            )}
          </div>
          {editRole ? (
            <div className="flex gap-2 flex-wrap">
              {ROLES.map(r => (
                <button
                  key={r}
                  onClick={() => setSelectedRole(r)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: selectedRole === r ? 'var(--deep)' : 'rgba(0,0,0,0.05)',
                    color: selectedRole === r ? 'white' : 'var(--stone)',
                  }}
                >
                  {r}
                </button>
              ))}
              <button
                onClick={() => updateMutation.mutate({ role: selectedRole })}
                disabled={updateMutation.isPending || selectedRole === profile.role}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-40"
                style={{ backgroundColor: 'var(--crimson)' }}
              >
                Save
              </button>
            </div>
          ) : (
            <span className="text-sm font-medium" style={{ color: 'var(--deep)' }}>
              {profile.role}
            </span>
          )}
        </div>
      </div>

      {/* Document */}
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 mb-4">
        <p className="text-xs font-semibold tracking-widest uppercase mb-3"
          style={{ color: 'var(--stone)' }}>
          Travel document
        </p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--deep)' }}>
              {profile.document_active_type === 'passport' ? 'Passport' : 'National ID'}
              {docNumber && (
                <span className="ml-2 font-mono text-xs font-normal"
                  style={{ color: 'var(--stone)' }}>
                  {docNumber}
                </span>
              )}
            </p>
            {profile.valid_through && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--stone)' }}>
                Valid through {formatDate(profile.valid_through)}
              </p>
            )}
          </div>
          {expiry && expiry !== 'ok' && (
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{
                backgroundColor: expiry === 'critical' ? '#bc474920' : '#f2cc8f33',
                color: expiry === 'critical' ? 'var(--crimson)' : '#7a5c00',
              }}
            >
              {expiry === 'critical' ? 'Expiring soon' : 'Check needed'}
            </span>
          )}
        </div>
      </div>

      {/* LOS data */}
      {los && (
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 mb-4">
          <p className="text-xs font-semibold tracking-widest uppercase mb-3"
            style={{ color: 'var(--stone)' }}>
            LOS data
          </p>
          <div className="grid grid-cols-3 gap-3">
            {LOS_KEYS.map(([key, label]) => (
              <div key={key}>
                <p className="text-xs" style={{ color: 'var(--stone)' }}>{label}</p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--deep)' }}>
                  {String(los[key] ?? '—')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trips */}
      {registrations.length > 0 && (
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: 'var(--stone)' }}>
              Trips
            </p>
            {totalPaid > 0 && (
              <p className="text-xs font-medium" style={{ color: 'var(--sage)' }}>
                {formatEur(totalPaid)} total paid
              </p>
            )}
          </div>
          <div className="space-y-2">
            {registrations.map(r => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-black/5 last:border-0">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--deep)' }}>
                    {r.trip.title}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--stone)' }}>
                    {r.trip.destination} · {formatDate(r.trip.start_date)}
                  </p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_PILL[r.status] ?? ''}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payments */}
      {payments.length > 0 && (
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 mb-4">
          <p className="text-xs font-semibold tracking-widest uppercase mb-3"
            style={{ color: 'var(--stone)' }}>
            Payment history
          </p>
          <div className="space-y-2">
            {payments.map(p => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-black/5 last:border-0">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--deep)' }}>
                    {p.trip.title}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--stone)' }}>
                    {formatDate(p.transaction_date)}
                    {p.note && ` · ${p.note}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold" style={{ color: 'var(--deep)' }}>
                    {formatEur(p.amount)}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_PILL[p.status] ?? ''}`}>
                    {p.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Event role requests */}
      {roleRequests.length > 0 && (
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 mb-4">
          <p className="text-xs font-semibold tracking-widest uppercase mb-3"
            style={{ color: 'var(--stone)' }}>
            Event role requests
          </p>
          <div className="space-y-2">
            {roleRequests.map(r => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-black/5 last:border-0">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--deep)' }}>
                    {r.role_label} · {r.event.title}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--stone)' }}>
                    {formatDate(r.event.start_time)}
                  </p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_PILL[r.status] ?? ''}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}