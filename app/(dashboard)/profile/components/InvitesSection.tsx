'use client'

import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { apiClient } from '@/lib/apiClient'
import { formatDate } from '@/lib/format'
import { guestStatus, computeFunnel, type GuestRow as InviteGuestRow } from '@/lib/invites'
import { StatusBadge } from './StatusBadge'

// ── Types ──────────────────────────────────────────────────────────────────

type GuestRow = InviteGuestRow & {
  id:         string
  name:       string
  email:      string
  created_at: string
}

type ShareLink = {
  id:           string
  token:        string
  share_method: 'native' | 'clipboard'
  click_count:  number
  created_at:   string
  revoked_at:   string | null
  event: { id: string; title: string; start_time: string }
  guests: GuestRow[]
}

type ApiResponse = { links: ShareLink[]; total: number }

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmt(d: string | null): string {
  return d !== null ? formatDate(d) : '—'
}

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
  const [pdfLoading,   setPdfLoading]   = useState(false)

  const queryClient = useQueryClient()
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const { data, isLoading } = useQuery<ApiResponse>({
    queryKey: ['invites'],
    queryFn:  () => apiClient('/api/profile/event-shares'),
  })

  const allLinks = data?.links ?? []

  async function handleRevoke(linkId: string) {
    setRevokingId(linkId)
    try {
      await apiClient(`/api/profile/event-shares/${linkId}`, { method: 'DELETE' })
      await queryClient.invalidateQueries({ queryKey: ['invites'] })
      toast.success(t('profile.invites.revokeSuccess'))
    } catch {
      toast.error(t('profile.invites.revokeError'))
    } finally {
      setRevokingId(null)
    }
  }

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
          if (filterStatus !== 'all' && guestStatus(g, !!l.revoked_at) !== filterStatus) return false
          if (filterQ && !g.name.toLowerCase().includes(filterQ.toLowerCase())) return false
          return true
        }),
      }))
  }, [allLinks, filterEvent, filterMethod, filterFrom, filterTo, filterStatus, filterQ])

  function buildCsvUrl(): string {
    const p = new URLSearchParams({ format: 'csv' })
    if (filterEvent  !== 'all') p.set('event_id', filterEvent)
    if (filterStatus !== 'all') p.set('status', filterStatus)
    if (filterMethod !== 'all') p.set('method', filterMethod)
    if (filterFrom)             p.set('from', filterFrom)
    if (filterTo)               p.set('to', filterTo)
    if (filterQ)                p.set('q', filterQ)
    return `/api/profile/event-shares/export?${p.toString()}`
  }

  async function handlePdfExport() {
    if (pdfLoading || filtered.length === 0) return
    setPdfLoading(true)
    try {
      // Dynamic import keeps jspdf out of the initial bundle
      const { generateInvitesPdf } = await import('@/lib/invites-pdf')
      generateInvitesPdf(filtered, 'Member')
    } catch (e) {
      console.error('PDF export failed', e)
    } finally {
      setPdfLoading(false)
    }
  }

  function toggleExpanded(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--skeleton-base)' }} />
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

        {/* Export buttons */}
        <div className="flex gap-1">
          <a
            href={buildCsvUrl()}
            download
            className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-colors hover:opacity-70"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            {t('profile.invites.exportCsv')}
          </a>
          <button
            onClick={handlePdfExport}
            disabled={pdfLoading || filtered.length === 0}
            className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-colors hover:opacity-70 disabled:opacity-40"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            {pdfLoading ? '…' : t('profile.invites.exportPdf')}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        {/* Event filter */}
        <Select value={filterEvent} onValueChange={setFilterEvent}>
          <SelectTrigger className="w-auto h-7 py-1 text-xs">
            <SelectValue placeholder={t('profile.invites.filterByEvent')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('profile.invites.filterByEvent')}</SelectItem>
            {eventOptions.map(([id, title]) => (
              <SelectItem key={id} value={id}>{title}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status pills */}
        <ToggleGroup
          type="single"
          size="sm"
          value={filterStatus}
          onValueChange={v => { if (v !== '') setFilterStatus(v) }}
        >
          {(['all', 'pending', 'confirmed', 'attended', 'cancelled'] as const).map(s => (
            <ToggleGroupItem key={s} value={s}>
              {s === 'all' ? t('profile.invites.filterByStatus') : s}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {/* Method pills */}
        <ToggleGroup
          type="single"
          size="sm"
          value={filterMethod}
          onValueChange={v => { if (v !== '') setFilterMethod(v) }}
        >
          {(['all', 'native', 'clipboard'] as const).map(m => (
            <ToggleGroupItem
              key={m}
              value={m}
              className="data-[state=on]:bg-[var(--brand-forest)]"
            >
              {m === 'all' ? t('profile.invites.filterByMethod') : t(`profile.invites.shareMethod.${m}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

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
            const revoked   = !!link.revoked_at
            const { confirmed, attended } = computeFunnel(guests, revoked)
            const isOpen    = !!expanded[link.id]

            return (
              <div key={link.id} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-default)' }}>
                {/* Event header */}
                <div className="w-full flex flex-wrap items-start justify-between gap-3 px-4 py-3" style={{ backgroundColor: 'var(--bg-card)' }}>
                  <button
                    onClick={() => toggleExpanded(link.id)}
                    aria-expanded={isOpen}
                    className="flex-1 min-w-0 text-left hover:opacity-70 transition-opacity"
                  >
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {link.event.title}
                      {revoked && (
                        <StatusBadge status="cancelled" className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold align-middle">
                          {t('profile.invites.revoked')}
                        </StatusBadge>
                      )}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {fmt(link.event.start_time)} · {t('profile.invites.sharedAt')} {fmt(link.created_at)}
                      {' · '}
                      {link.share_method === 'native'
                        ? t('profile.invites.shareMethod.native')
                        : t('profile.invites.shareMethod.clipboard')}
                    </p>
                  </button>

                  {/* Funnel summary + expand toggle */}
                  <button
                    onClick={() => toggleExpanded(link.id)}
                    aria-expanded={isOpen}
                    className="flex items-center flex-wrap gap-3 text-[10px] font-semibold hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <span>{link.click_count} {t('profile.invites.clicks')}</span>
                    <span>→</span>
                    <span>{guests.length} {t('profile.invites.registrations')}</span>
                    <span>→</span>
                    <span style={{ color: confirmed > 0 ? 'var(--status-success-fg)' : undefined }}>{confirmed} {t('profile.invites.confirmed')}</span>
                    <span>→</span>
                    <span style={{ color: attended > 0 ? 'var(--status-success-fg)' : undefined }}>{attended} {t('profile.invites.attended')}</span>
                    <span style={{ fontSize: 10 }}>{isOpen ? '▲' : '▼'}</span>
                  </button>

                  {!revoked && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-colors hover:opacity-70 disabled:opacity-40"
                          style={{ borderColor: 'var(--border-default)', color: 'var(--brand-crimson)' }}
                          disabled={revokingId === link.id}
                        >
                          {t('profile.invites.revoke')}
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('profile.invites.revokeConfirmTitle')}</AlertDialogTitle>
                          <AlertDialogDescription>{t('profile.invites.revokeConfirmDesc')}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('event.cancel')}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleRevoke(link.id)}>
                            {t('profile.invites.revoke')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>

                {/* Guest table — sm+, expandable */}
                {isOpen && guests.length > 0 && (
                  <>
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full text-xs" style={{ minWidth: 480 }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--bg-card-raised)', borderTop: '1px solid var(--border-default)' }}>
                            {[
                              t('profile.invites.col.name'),
                              t('profile.invites.col.email'),
                              t('profile.invites.col.status'),
                              t('profile.invites.col.registered'),
                              t('profile.invites.col.attended'),
                            ].map(h => (
                              <th key={h} className="text-left px-4 py-2 font-semibold text-[10px] tracking-wider uppercase"
                                style={{ color: 'var(--text-secondary)' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {guests.map(g => {
                            const s = guestStatus(g, revoked)
                            return (
                              <tr key={g.id} style={{ borderTop: '1px solid var(--border-default)' }}>
                                <td className="px-4 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{g.name}</td>
                                <td className="px-4 py-2" style={{ color: 'var(--text-secondary)' }}>{g.email}</td>
                                <td className="px-4 py-2">
                                  <StatusBadge status={s} className="px-2 py-0.5 rounded-full text-[10px] font-semibold">{s}</StatusBadge>
                                </td>
                                <td className="px-4 py-2" style={{ color: 'var(--text-secondary)' }}>{fmt(g.created_at)}</td>
                                <td className="px-4 py-2" style={{ color: 'var(--text-secondary)' }}>{fmt(g.attended_at)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Guest cards — below sm */}
                    <div className="sm:hidden">
                      {guests.map(g => {
                        const s = guestStatus(g, revoked)
                        return (
                          <div key={g.id} className="px-4 py-3 space-y-1" style={{ borderTop: '1px solid var(--border-default)' }}>
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{g.name}</p>
                              <StatusBadge status={s} className="px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0">{s}</StatusBadge>
                            </div>
                            <p className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>{g.email}</p>
                            <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                              {t('profile.invites.col.registered')} {fmt(g.created_at)}
                              {' · '}
                              {t('profile.invites.col.attended')} {fmt(g.attended_at)}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </>
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
