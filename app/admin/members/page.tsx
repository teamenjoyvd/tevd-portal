'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'

type MemberRow = {
  id: string
  first_name: string
  last_name: string
  abo_number: string | null
  role: 'admin' | 'core' | 'member' | 'guest'
  valid_through: string | null
  document_active_type: 'id' | 'passport'
  created_at: string
  tree_nodes: { path: string; depth: number }[] | null
}

function getExpiryState(validThrough: string | null): 'ok' | 'warning' | 'critical' | null {
  if (!validThrough) return null
  const diff = (new Date(validThrough).getTime() - Date.now()) / 86400000
  if (diff < 0)   return 'critical'
  if (diff < 90)  return 'critical'
  if (diff < 180) return 'warning'
  return 'ok'
}

const EXPIRY_DOT: Record<string, string> = {
  ok:       'var(--sage)',
  warning:  'var(--sandy)',
  critical: 'var(--crimson)',
}

const ROLE_BADGE: Record<string, { bg: string; color: string }> = {
  admin:  { bg: 'var(--deep)',    color: 'white'             },
  core:   { bg: 'var(--sienna)', color: 'white'              },
  member: { bg: 'rgba(0,0,0,0.06)', color: 'var(--deep)'    },
  guest:  { bg: 'rgba(0,0,0,0.04)', color: 'var(--stone)'   },
}

export default function MembersPage() {
  const [search, setSearch] = useState('')

  const { data: members = [], isLoading } = useQuery<MemberRow[]>({
    queryKey: ['admin-members'],
    queryFn: () => fetch('/api/admin/members').then(r => r.json()),
  })

  const filtered = members.filter(m => {
    const q = search.toLowerCase()
    return (
      m.first_name.toLowerCase().includes(q) ||
      m.last_name.toLowerCase().includes(q) ||
      (m.abo_number ?? '').includes(q)
    )
  })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-semibold" style={{ color: 'var(--deep)' }}>
            Members
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--stone)' }}>
            {members.length} total
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="15" height="15"
          viewBox="0 0 24 24" fill="none" stroke="var(--stone)" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or ABO number…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-black/10 text-sm bg-white"
          style={{ color: 'var(--deep)' }}
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl animate-pulse"
              style={{ backgroundColor: 'rgba(0,0,0,0.05)' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm" style={{ color: 'var(--stone)' }}>
            {search ? 'No members match your search.' : 'No members yet.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-black/5 overflow-hidden shadow-sm">
          {filtered.map((m, i) => {
            const expiry = getExpiryState(m.valid_through)
            const depth = m.tree_nodes?.[0]?.depth ?? null
            return (
              <Link
                key={m.id}
                href={`/admin/members/${m.id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-black/[0.02] transition-colors"
                style={{ borderTop: i > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}
              >
                {/* Avatar */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ backgroundColor: 'var(--eggshell)', color: 'var(--deep)' }}
                >
                  {m.first_name[0]}{m.last_name[0]}
                </div>

                {/* Name + ABO */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--deep)' }}>
                    {m.first_name} {m.last_name}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--stone)' }}>
                    {m.abo_number ?? 'No ABO'}
                    {depth !== null && ` · Depth ${depth}`}
                  </p>
                </div>

                {/* Role badge */}
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: ROLE_BADGE[m.role].bg,
                    color: ROLE_BADGE[m.role].color,
                  }}
                >
                  {m.role}
                </span>

                {/* Doc expiry dot */}
                {expiry && expiry !== 'ok' && (
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: EXPIRY_DOT[expiry] }}
                    title={`Document expiry: ${expiry}`}
                  />
                )}

                {/* Chevron */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="var(--stone)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}