'use client'

/**
 * The full payment ledger (2608-DEV-688).
 *
 * The bento shows the latest handful of transactions; this is the drill-down
 * behind it. No new API route: it reuses GET /api/payments under the same
 * ['profile-generic-payments'] query key the bento populates, so arriving here
 * by client-side navigation mounts warm off that cache.
 *
 * Filtering happens at ENTRY level, never at row level. Filtering rows first
 * would let a search term match one beneficiary of a three-person transfer and
 * then render that group with a partial total — a number no bank statement
 * would agree with. An entry either survives whole or not at all.
 *
 * One responsive file, not two: a `<table>` from md: up, stacked cards below.
 * Six columns permits a split under the Layout Decision Rules but does not
 * require one, and two files would duplicate the same mapping twice.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { apiClient } from '@/lib/apiClient'
import { formatCurrency, formatDate } from '@/lib/format'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  beneficiaryNames,
  ledgerEntries,
  lifetimeTotals,
  payerName,
  toLedgerCSV,
  type CurrencyTotals,
  type LedgerEntry,
} from '@/lib/payments/ledger'
import { useProfile } from '../useProfile'
import { type GenericPayment } from '../types'
import { BentoSkeleton } from '../components/BentoSkeleton'
import { StatusBadge } from '../components/StatusBadge'

type SortKey = 'date' | 'amount'
type SortDir = 'asc' | 'desc'

const STATUS_OPTIONS = ['all', 'approved', 'pending', 'rejected'] as const

export function PaymentsLedgerClient() {
  const { t } = useLanguage()
  const { data: profile } = useProfile()
  const me = profile?.id ?? ''

  const { data: payments, isLoading } = useQuery<GenericPayment[]>({
    queryKey: ['profile-generic-payments'],
    queryFn: () => apiClient('/api/payments'),
    // `me` is '' until useProfile resolves — compared explicitly rather than
    // truthiness-tested, per the repo's zero-is-data rule.
    enabled: me !== '',
    staleTime: 2 * 60 * 1000,
  })

  // ── Filter state ────────────────────────────────────────────────────────────
  const [status, setStatus] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // 300 ms, matching AdminCalendarClient — long enough that typing does not
  // re-filter per keystroke, short enough to feel immediate.
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(value), 300)
  }, [])

  // The pending timer must not outlive the component: navigating away mid-type
  // would otherwise fire setDebouncedSearch on an unmounted tree.
  useEffect(() => () => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
  }, [])

  const guestTag = t('payment.guestTag')
  const rows = useMemo(() => payments ?? [], [payments])

  // Lifetime, over RAW rows and deliberately outside every filter above:
  // collapsing first would double-count a payer's own share of their own group.
  const totals = useMemo(() => lifetimeTotals(rows, me), [rows, me])

  const allEntries = useMemo(() => ledgerEntries(rows, me), [rows, me])

  const visibleEntries = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase()

    const filtered = allEntries.filter(entry => {
      if (status !== 'all' && entry.status !== status) return false

      // Inclusive [from, to] on the calendar day. transaction_date is a DATE, so
      // comparing the leading 10 characters is a plain lexicographic ISO
      // comparison — no timezone shifts the day here.
      const day = entry.transaction_date.slice(0, 10)
      // '' is the unset state of a <input type="date"> and of the search box —
      // compared explicitly so an empty bound is never read as a filter.
      if (dateFrom !== '' && day < dateFrom) return false
      if (dateTo !== '' && day > dateTo) return false

      if (needle !== '') {
        const haystack = [
          entry.title,
          entry.payment_method ?? '',
          ...beneficiaryNames(entry, me, guestTag),
          payerName(entry, me) ?? '',
          ...entry.rows.map(r => r.note ?? ''),
        ]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(needle)) return false
      }

      return true
    })

    // Copy before sorting: .sort() mutates, and `filtered` is derived from the
    // memoised allEntries whose order other readers depend on.
    const sorted = [...filtered]
    sorted.sort((a, b) => {
      const cmp =
        sortKey === 'amount'
          ? a.amount - b.amount
          : a.transaction_date.localeCompare(b.transaction_date)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [allEntries, status, debouncedSearch, dateFrom, dateTo, sortKey, sortDir, me, guestTag])

  // Read sortKey directly rather than nesting setSortDir inside a setSortKey
  // updater: updaters are double-invoked under strict mode, which would flip
  // the direction twice and leave it unchanged.
  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }, [sortKey])

  const handleExport = useCallback(() => {
    // The RAW rows behind the visible entries: an export is an audit artifact,
    // so a collapsed group must still export as its individual shares.
    const csv = toLedgerCSV(visibleEntries.flatMap(e => e.rows), guestTag)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [visibleEntries, guestTag])

  if (isLoading || me === '') {
    return (
      <div>
        <h1 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          {t('payment.allPayments')}
        </h1>
        <BentoSkeleton rows={5} />
      </div>
    )
  }

  const statusLabel = (value: string) =>
    value === 'all' ? t('payment.allStatuses')
      : value === 'approved' ? t('payment.approved')
      : value === 'pending' ? t('payment.pending')
      : t('payment.rejected')

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          {t('payment.allPayments')}
        </h1>
        <button
          type="button"
          onClick={handleExport}
          disabled={visibleEntries.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 flex-shrink-0"
          style={{ backgroundColor: 'var(--brand-forest)', color: 'var(--brand-parchment)', minHeight: '32px' }}
        >
          <Download size={14} />
          {t('payment.exportCsv')}
        </button>
      </div>

      {/* Lifetime totals. Rendered above the filters and labelled, because a
          total that ignores the filter sitting next to it is otherwise read as
          a bug. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4" data-testid="ledger-totals">
        <TotalCard label={t('payment.totalPaid')} totals={totals.paid} />
        <TotalCard label={t('payment.totalOnBehalf')} totals={totals.onBehalf} />
        <TotalCard label={t('payment.totalPaidForMe')} totals={totals.paidForMe} />
      </div>
      <p className="text-[11px] mb-5" style={{ color: 'var(--text-secondary)' }}>
        {t('payment.lifetimeNote')}
      </p>

      {/* Filters. Stacked at 390px, one row from sm: up. */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mb-4">
        <input
          type="search"
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
          placeholder={t('payment.search')}
          className="flex-1 min-w-0 sm:min-w-[220px] rounded-xl px-3 py-2 text-xs"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
            minHeight: '40px',
          }}
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-[160px] h-10 text-xs">
            <SelectValue placeholder={t('payment.filterStatus')} />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(option => (
              <SelectItem key={option} value={option}>
                {statusLabel(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <label className="flex-1 min-w-0 flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            {t('payment.dateFrom')}
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full min-w-0 rounded-xl px-2 py-2 text-xs"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)',
                minHeight: '40px',
              }}
            />
          </label>
          <label className="flex-1 min-w-0 flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            {t('payment.dateTo')}
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full min-w-0 rounded-xl px-2 py-2 text-xs"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)',
                minHeight: '40px',
              }}
            />
          </label>
        </div>
      </div>

      {visibleEntries.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--text-secondary)' }}>
          {/* An untouched ledger is not a filter miss. `noResults` reads "No
              payments match these filters", which blames a filter a member with
              zero payments never set. */}
          {allEntries.length === 0 ? t('payment.none') : t('payment.noResults')}
        </p>
      ) : (
        <>
          {/* ── Stacked cards, below md ─────────────────────────────────────── */}
          <div className="space-y-2 md:hidden" data-testid="ledger-cards">
            {visibleEntries.map(entry => (
              <EntryCard key={entry.key} entry={entry} me={me} guestTag={guestTag} />
            ))}
          </div>

          {/* ── Table, md and up. overflow-x-auto so a long name scrolls the
                table, never the page. ───────────────────────────────────────── */}
          <div className="hidden md:block overflow-x-auto rounded-2xl" style={{ border: '1px solid var(--border-default)' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-global)' }}>
                  <SortableHeader label={t('payment.date')} active={sortKey === 'date'} dir={sortDir} onClick={() => toggleSort('date')} />
                  <SortableHeader label={t('payment.amount')} active={sortKey === 'amount'} dir={sortDir} onClick={() => toggleSort('amount')} />
                  <HeaderCell>{t('payment.item')}</HeaderCell>
                  <HeaderCell>{t('payment.attribution')}</HeaderCell>
                  <HeaderCell>{t('payment.method')}</HeaderCell>
                  <HeaderCell>{t('payment.status')}</HeaderCell>
                </tr>
              </thead>
              <tbody>
                {visibleEntries.map(entry => (
                  <tr key={entry.key} style={{ borderTop: '1px solid var(--border-default)' }}>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                      {formatDate(entry.transaction_date)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {formatCurrency(entry.amount, entry.currency)}
                    </td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{entry.title}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>
                      <Attribution entry={entry} me={me} guestTag={guestTag} />
                    </td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{entry.payment_method ?? ''}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={entry.status} className="font-semibold px-2 py-0.5 rounded-control whitespace-nowrap">
                        {entry.status}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Who the entry was for, or who paid it. Exactly one of the two applies: an
 * entry the viewer paid names its beneficiaries, an entry someone else paid
 * names the payer.
 */
function Attribution({ entry, me, guestTag }: { entry: LedgerEntry; me: string; guestTag: string }) {
  const { t } = useLanguage()
  const forNames = beneficiaryNames(entry, me, guestTag)
  const paidBy = payerName(entry, me)

  if (paidBy != null) return <>{t('payment.paidBy')} {paidBy}</>
  if (forNames.length > 0) return <>{t('payment.for')} {forNames.join(', ')}</>
  return null
}

const HEADER_CELL_CLASS = 'px-3 py-2 text-left text-[11px] font-semibold tracking-wide uppercase'

function HeaderCell({ children }: { children: React.ReactNode }) {
  return (
    <th className={HEADER_CELL_CLASS} style={{ color: 'var(--text-secondary)' }}>
      {children}
    </th>
  )
}

function SortableHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string
  active: boolean
  dir: SortDir
  onClick: () => void
}) {
  return (
    <HeaderCell>
      <button type="button" onClick={onClick} className="uppercase hover:opacity-70 transition-opacity">
        {label}
        {active && (dir === 'asc' ? ' ↑' : ' ↓')}
      </button>
    </HeaderCell>
  )
}

function EntryCard({ entry, me, guestTag }: { entry: LedgerEntry; me: string; guestTag: string }) {
  const { t } = useLanguage()
  return (
    <div
      className="rounded-xl px-3 py-2.5 text-xs"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
    >
      <div className="flex items-center gap-2">
        <span className="font-semibold flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
          {formatCurrency(entry.amount, entry.currency)}
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>{formatDate(entry.transaction_date)}</span>
        <StatusBadge status={entry.status} className="ml-auto font-semibold px-2 py-0.5 rounded-control flex-shrink-0">
          {entry.status}
        </StatusBadge>
      </div>
      <p className="mt-1 truncate min-w-0 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
        {entry.title}
        {/* The separator earns its place only when both sides are present; '' is
            "no title" and null is "no method", so neither may be truthy-tested. */}
        {entry.title !== '' && entry.payment_method != null && entry.payment_method !== '' ? ' · ' : ''}
        {entry.payment_method}
      </p>
      <p className="truncate min-w-0 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
        <Attribution entry={entry} me={me} guestTag={guestTag} />
      </p>
      {entry.admin_note != null && entry.admin_note !== '' && (
        <p className="mt-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
          {t('payment.note')}: {entry.admin_note}
        </p>
      )}
    </div>
  )
}

/** One lifetime bucket. Renders every currency it holds — a member who paid in
 *  EUR and USD must not be shown one number that silently adds them. */
function TotalCard({ label, totals }: { label: string; totals: CurrencyTotals }) {
  const codes = Object.keys(totals).sort()
  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
    >
      <p className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </p>
      {codes.length === 0 ? (
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {formatCurrency(0, 'EUR')}
        </p>
      ) : (
        codes.map(code => (
          <p key={code} className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {formatCurrency(totals[code], code)}
          </p>
        ))
      )}
    </div>
  )
}
