'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { apiClient } from '@/lib/apiClient'

// ── Types ──────────────────────────────────────────────────────────────────

type GuestRow = {
  id:          string
  name:        string
  email:       string
  status:      string
  attended_at: string | null
  created_at:  string
}

type ShareLink = {
  id:           string
  token:        string
  share_method: 'native' | 'clipboard'
  click_count:  number
  created_at:   string
  event: { id: string; title: string; start_time: string }
  guests: GuestRow[]
}

type ApiResponse = { links: ShareLink[]; total: number }

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmt(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function guestStatus(g: GuestRow): 'pending' | 'confirmed' | 'attended' {
  if (g.attended_at) return 'attended'
  if (g.status === 'confirmed') return 'confirmed'
  return 'pending'
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending:   { bg: 'rgba(242,204,143,0.3)', color: '#7a5c00' },
  confirmed: { bg: 'rgba(61,64,91,0.08)',   color: '#3d405b' },
  attended:  { bg: 'rgba(129,178,154,0.2)', color: '#2d6a4f' },
}

export const INVITES_MIN_HEIGHT = 240

// ── Component ────────────────────────────────────────────────────────────────

export function InvitesSection() {
  const { t } = useLanguage()

  // ── Filters (client-side, no re-fetch) ───────────────────────────────────
  const [filterEvent,  setFilterEvent]  = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterMethod, setFilterMethod] = useState<string>('all')
  const [filterFrom,   setFilterFrom]   = useState<string>('')
  const [filterTo,     setFilterTo]     = useState<string>('')
  const [filterQ,      setFilterQ]      = useState<string>('')
  const [expanded,     setExpanded]     = useState<Record<string, boolean>>({})

  const { data, isLoading } = useQuery<ApiResponse>({
    queryKey: ['invites'],
    queryFn:  () => apiClient('/api/profile/event-shares'),
  })

  const allLinks = data?.links ?? []

  // Unique events for the event filter dropdown
  const eventOptions = useMemo(() => {
    const seen = new Map<string, string>()
    allLinks.forEach(l => seen.set(l.event.id, l.event.title))
    return Array.from(seen.entries())
  }, [allLinks])

  // Apply all filters in-memory
  const filtered = useMemo(() => {
    return allLinks
      .filter(l => {
        if (filterEvent !== 'all' && l.event.id !== filterEvent) return false
        if (filterMethod !== 'all' && l.share_method !== filterMethod) return false
        if (filterFrom && l.created_at < filterFrom) return false
        if (filterTo   && l.created_at > filterTo + 'T23:59:59') return false
        return true
      })
      .map(l => ({
        ...l,
        guests: l.guests.filter(g => {
          if (filterStatus !== 'all' && guestStatus(g) !== filterStatus) return false
          if (filterQ && !g.name.toLowerCase().includes(filterQ.toLowerCase())) return false
          return true
        }),
      }))
  }, [allLinks, filterEvent, filterMethod, filterFrom, filterTo, filterStatus, filterQ])

  function buildExportUrl(format: 'csv' | 'pdf'): string {
    const p = new URLSearchParams({ format })
    if (filterEvent  !== 'all') p.set('event_id', filterEvent)
    if (filterStatus !== 'all') p.set('status', filterStatus)
    if (filterMethod !== 'all') p.set('method', filterMethod)
    if (filterFrom)             p.set('from', filterFrom)
    if (filterTo)               p.set('to', filterTo)
    if (filterQ)                p.set('q', filterQ)
    return `/api/profile/event-shares/export?${p.toString()}`
  }

  function toggleExpanded(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.06)' }} />
        ))}
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Title + export */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>
          {t('profile.invites.title')}
        </p>

        {/* Export dropdown */}
        <div className="flex gap-1">
          <a
            href={buildExportUrl('csv')}
            download
            className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-colors hover:opacity-70"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            {t('profile.invites.exportCsv')}
          </a>
          <a
            href={buildExportUrl('pdf')}
            download
            className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-colors hover:opacity-70"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            {t('profile.invites.exportPdf')}
          </a>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        {/* Event filter */}
        <select
          value={filterEvent}
          onChange={e => setFilterEvent(e.target.value)}
          className="text-xs rounded-lg border px-2 py-1 outline-none"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
        >
          <option value="all">{t('profile.invites.filterByEvent')}</option>
          {eventOptions.map(([id, title]) => (
            <option key={id} value={id}>{title}</option>
          ))}
        </select>

        {/* Status pills */}
        {(['all', 'pending', 'confirmed', 'attended'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all"
            style={{
              backgroundColor: filterStatus === s ? 'var(--brand-teal)' : 'rgba(0,0,0,0.05)',
              color: filterStatus === s ? 'white' : 'var(--text-secondary)',
            }}
          >
            {s === 'all' ? t('profile.invites.filterByStatus') : s}
          </button>
        ))}

        {/* Method pills */}
        {(['all', 'native', 'clipboard'] as const).map(m => (
          <button
            key={m}
            onClick={() => setFilterMethod(m)}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all"
            style={{
              backgroundColor: filterMethod === m ? 'var(--brand-forest)' : 'rgba(0,0,0,0.05)',
              color: filterMethod === m ? 'white' : 'var(--text-secondary)',
            }}
          >
            {m === 'all' ? t('profile.invites.filterByMethod') : t(`profile.invites.shareMethod.${m}` as any)}
          </button>
        ))}

        {/* Date range */}
        <input
          type="date"
          value={filterFrom}
          onChange={e => setFilterFrom(e.target.value)}
          className="text-xs rounded-lg border px-2 py-1 outline-none"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
        />
        <input
          type="date"
          value={filterTo}
          onChange={e => setFilterTo(e.target.value)}
          className="text-xs rounded-lg border px-2 py-1 outline-none"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
        />

        {/* Guest name search */}
        <input
          type="text"
          value={filterQ}
          onChange={e => setFilterQ(e.target.value)}
          placeholder={t('profile.invites.guestName')}
          className="text-xs rounded-lg border px-2 py-1 outline-none flex-1 min-w-[120px]"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
        />
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <p className="text-xs py-4 text-center" style={{ color: 'var(--text-secondary)' }}>
          {t('profile.invites.empty')}
        </p>
      ) : (
        <div className="space-y-4">
          {filtered.map(link => {
            const guests    = link.guests
            const confirmed = guests.filter(g => guestStatus(g) !== 'pending').length
            const attended  = guests.filter(g => g.attended_at).length
            const isOpen    = !!expanded[link.id]

            return (
              <div key={link.id} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-default)' }}>
                {/* Event header */}
                <button
                  onClick={() => toggleExpanded(link.id)}
                  className="w-full text-left px-4 py-3 flex items-start justify-between gap-3 hover:bg-black/[0.02] transition-colors"
                  style={{ backgroundColor: 'var(--bg-card)' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {link.event.title}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {fmt(link.event.start_time)} · {t('profile.invites.sharedAt')} {fmt(link.created_at)}
                      {' · '}
                      {link.share_method === 'native'
                        ? t('profile.invites.shareMethod.native')
                        : t('profile.invites.shareMethod.clipboard')}
                    </p>
                  </div>
                  {/* Funnel summary */}
                  <div className="flex items-center gap-3 flex-shrink-0 text-[10px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    <span>{link.click_count} {t('profile.invites.clicks')}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>→</span>
                    <span>{guests.length} {t('profile.invites.registrations')}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>→</span>
                    <span style={{ color: confirmed > 0 ? '#3d405b' : undefined }}>{confirmed} {t('profile.invites.confirmed')}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>→</span>
                    <span style={{ color: attended > 0 ? '#2d6a4f' : undefined }}>{attended} {t('profile.invites.attended')}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>

                {/* Guest table — expandable */}
                {isOpen && guests.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs" style={{ minWidth: 480 }}>
                      <thead>
                        <tr style={{ backgroundColor: 'rgba(0,0,0,0.03)', borderTop: '1px solid var(--border-default)' }}>
                          {['Name', 'Email', 'Status', 'Registered', 'Attended'].map(h => (
                            <th key={h} className="text-left px-4 py-2 font-semibold text-[10px] tracking-wider uppercase"
                              style={{ color: 'var(--text-secondary)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {guests.map(g => {
                          const s = guestStatus(g)
                          return (
                            <tr key={g.id} style={{ borderTop: '1px solid var(--border-default)' }}>
                              <td className="px-4 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{g.name}</td>
                              <td className="px-4 py-2" style={{ color: 'var(--text-secondary)' }}>{g.email}</td>
                              <td className="px-4 py-2">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                  style={STATUS_STYLE[s]}>{s}</span>
                              </td>
                              <td className="px-4 py-2" style={{ color: 'var(--text-secondary)' }}>{fmt(g.created_at)}</td>
                              <td className="px-4 py-2" style={{ color: 'var(--text-secondary)' }}>{fmt(g.attended_at)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {isOpen && guests.length === 0 && (
                  <p className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)', borderTop: '1px solid var(--border-default)' }}>
                    {t('profile.invites.empty')}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
