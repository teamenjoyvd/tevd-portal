'use client'

import { useState, useCallback } from 'react'
import { useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { getRoleColors } from '@/lib/role-colors'
import { useLanguage } from '@/lib/hooks/useLanguage'

// ── Types ─────────────────────────────────────────────────────────────────────

export type LOSMember = {
  abo_number: string
  sponsor_abo_number: string | null
  abo_level: string | null
  name: string | null
  country: string | null
  gpv: number
  ppv: number
  bonus_percent: number
  group_size: number
  annual_ppv: number
  renewal_date: string | null
  profile: {
    id: string
    first_name: string
    last_name: string
    role: string
  } | null
}

type VerificationRequest = {
  id: string
  profile_id: string
  claimed_abo: string
  claimed_upline_abo: string
  status: string
  created_at: string
  profiles: { first_name: string; last_name: string } | null
}

type Guest = {
  id: string
  first_name: string
  last_name: string
  role: string
  created_at: string
}

export type MembersData = {
  los_members: LOSMember[]
  pending_verifications: VerificationRequest[]
  unverified_guests: Guest[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatNum(n: number) {
  return new Intl.NumberFormat('en-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

const LEVEL_BG: Record<string, { bg: string; color: string }> = {
  '1': { bg: 'var(--brand-forest)', color: 'white' },
  '2': { bg: 'var(--brand-crimson)', color: 'white' },
  '3': { bg: 'rgba(0,0,0,0.08)', color: 'var(--text-primary)' },
}

// ── LosTable ──────────────────────────────────────────────────────────────────

const colHelper = createColumnHelper<LOSMember>()

function LosTable({
  members,
  isLoading,
  onPromote,
  promotePending,
}: {
  members: LOSMember[]
  isLoading: boolean
  onPromote: (profileId: string, role: string) => void
  promotePending: boolean
}) {
  const { lang, t } = useLanguage()
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({ sponsor_abo_number: false })
  const [colsOpen, setColsOpen] = useState(false)
  const colsRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedFilter, setDebouncedFilter] = useState('')

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (colsRef.current && !colsRef.current.contains(e.target as Node)) {
        setColsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSearch = useCallback((value: string) => {
    setGlobalFilter(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedFilter(value), 300)
  }, [])

  const columns = [
    colHelper.accessor(row => row.profile
      ? `${row.profile.first_name} ${row.profile.last_name}`
      : (row.name ?? row.abo_number), {
      id: 'name',
      header: t('admin.members.table.name'),
      enableSorting: true,
      cell: ({ row }) => {
        const m = row.original
        const lvl = m.abo_level ?? '?'
        const lc = LEVEL_BG[lvl] ?? LEVEL_BG['3']
        const profileRc = m.profile ? getRoleColors(m.profile.role) : null
        return (
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold flex-shrink-0"
              style={{ backgroundColor: lc.bg, color: lc.color }}>{lvl}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {m.profile ? `${m.profile.first_name} ${m.profile.last_name}` : (m.name ?? '—')}
              </p>
            </div>
            {m.profile && profileRc && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: profileRc.bg, color: profileRc.font }}>{m.profile.role}</span>
            )}
          </div>
        )
      },
    }),
    colHelper.accessor('abo_number', {
      header: t('admin.members.table.abo'),
      enableSorting: false,
      cell: ({ getValue }) => (
        <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{getValue()}</span>
      ),
    }),
    colHelper.accessor('sponsor_abo_number', {
      id: 'sponsor_abo_number',
      header: t('admin.members.table.sponsorAbo'),
      enableSorting: false,
      cell: ({ getValue }) => (
        <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{getValue() ?? '—'}</span>
      ),
    }),
    colHelper.accessor('abo_level', {
      header: t('admin.members.table.level'),
      enableSorting: true,
      cell: ({ getValue }) => {
        const lvl = getValue() ?? '?'
        const lc = LEVEL_BG[lvl] ?? LEVEL_BG['3']
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: lc.bg, color: lc.color }}>{lvl}</span>
        )
      },
    }),
    colHelper.accessor('gpv', {
      header: t('admin.members.table.gpv'),
      enableSorting: true,
      cell: ({ getValue }) => (
        <span className="text-xs tabular-nums font-semibold" style={{ color: 'var(--text-primary)' }}>
          {formatNum(getValue())}
        </span>
      ),
    }),
    colHelper.accessor('bonus_percent', {
      header: t('admin.members.table.bonus'),
      enableSorting: true,
      cell: ({ getValue }) => (
        <span className="text-xs tabular-nums font-semibold"
          style={{ color: Number(getValue()) > 0 ? 'var(--brand-teal)' : 'var(--text-secondary)' }}>
          {getValue()}%
        </span>
      ),
    }),
    colHelper.accessor('group_size', {
      header: t('admin.members.table.group'),
      enableSorting: true,
      cell: ({ getValue }) => (
        <span className="text-xs tabular-nums" style={{ color: 'var(--text-primary)' }}>{getValue()}</span>
      ),
    }),
    colHelper.display({
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const m = row.original
        if (!m.profile || m.profile.role === 'admin') return null
        return (
          <div className="flex gap-1 justify-end">
            {m.profile.role === 'member' && (
              <button
                onClick={() => onPromote(m.profile!.id, 'core')}
                disabled={promotePending}
                className="px-3 py-1 rounded-lg text-xs font-semibold disabled:opacity-40 hover:opacity-80 transition-opacity"
                style={{ backgroundColor: 'var(--brand-crimson)', color: 'white' }}
              >
                → Core
              </button>
            )}
            {m.profile.role === 'core' && (
              <button
                onClick={() => onPromote(m.profile!.id, 'member')}
                disabled={promotePending}
                className="px-3 py-1 rounded-lg text-xs font-semibold disabled:opacity-40 hover:opacity-80 transition-opacity"
                style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--text-secondary)' }}
              >
                → Member
              </button>
            )}
          </div>
        )
      },
    }),
  ]

  const table = useReactTable({
    data: members,
    columns,
    state: {
      sorting,
      globalFilter: debouncedFilter,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _colId, filterValue: unknown) => {
      const q = typeof filterValue === 'string' ? filterValue.toLowerCase() : ''
      const m = row.original
      const name = m.profile
        ? `${m.profile.first_name} ${m.profile.last_name}`.toLowerCase()
        : (m.name ?? '').toLowerCase()
      return name.includes(q) || m.abo_number.toLowerCase().includes(q)
    },
    initialState: { pagination: { pageSize: 25 } },
  })

  const TOGGLEABLE_COLS = ['abo_number', 'sponsor_abo_number', 'abo_level', 'gpv', 'bonus_percent', 'group_size']
  const COL_LABELS: Record<string, string> = {
    abo_number: t('admin.members.table.abo'), sponsor_abo_number: t('admin.members.table.sponsorAbo'), abo_level: t('admin.members.table.level'),
    gpv: t('admin.members.table.gpv'), bonus_percent: t('admin.members.table.bonus'), group_size: t('admin.members.table.group'),
  }
  const MOBILE_HIDDEN = new Set(['gpv', 'bonus_percent', 'group_size', 'sponsor_abo_number'])

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="h-14 rounded-2xl animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }} />
        ))}
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <div className="text-center py-16 rounded-2xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('admin.members.noLosData')}</p>
      </div>
    )
  }

  const { pageIndex } = table.getState().pagination
  const totalPages = table.getPageCount()

  return (
    <div>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <input
          value={globalFilter}
          onChange={e => handleSearch(e.target.value)}
          placeholder={t('admin.members.searchPlaceholder')}
          className="flex-1 min-w-[180px] border rounded-xl px-3 py-2 text-sm"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }}
        />
        <div ref={colsRef} className="relative">
          <button
            onClick={() => setColsOpen(o => !o)}
            className="px-3 py-2 rounded-xl text-xs font-semibold border hover:bg-black/5 transition-colors"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >{t('admin.members.btn.columns')}</button>
          {colsOpen && (
            <div
              className="absolute right-0 top-full mt-1 z-20 rounded-xl border shadow-lg p-2 space-y-1 min-w-[140px]"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
            >
              {TOGGLEABLE_COLS.map(colId => (
                <label key={colId} className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-black/5">
                  <input
                    type="checkbox"
                    checked={table.getColumn(colId)?.getIsVisible() ?? true}
                    onChange={e => table.getColumn(colId)?.getToggleVisibilityHandler()(e)}
                    className="w-3.5 h-3.5 accent-[var(--brand-crimson)]"
                  />
                  <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{COL_LABELS[colId]}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
        <Table className="border-collapse">
          <TableHeader>
            {table.getHeaderGroups().map(hg => (
              <TableRow key={hg.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }} className="border-0 hover:bg-transparent">
                {hg.headers.map(header => {
                  const isMobileHidden = MOBILE_HIDDEN.has(header.id)
                  return (
                    <TableHead
                      key={header.id}
                      className={`py-3${isMobileHidden ? ' hidden lg:table-cell' : ''}`}
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={`flex items-center gap-1 text-xs font-semibold tracking-widest uppercase select-none${header.column.getCanSort() ? ' cursor-pointer hover:opacity-70' : ''}`}
                          onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === 'asc' && <span className="text-[10px]">▲</span>}
                          {header.column.getIsSorted() === 'desc' && <span className="text-[10px]">▼</span>}
                          {header.column.getCanSort() && !header.column.getIsSorted() && (
                            <>
                              {/* eslint-disable-next-line i18next/no-literal-string */}
                              <span className="text-[10px] opacity-30">▲▼</span>
                            </>
                          )}
                        </div>
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row, i) => (
              <TableRow
                key={row.id}
                className="border-0 hover:bg-transparent"
                style={{ borderTop: i > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}
              >
                {row.getVisibleCells().map(cell => {
                  const isMobileHidden = MOBILE_HIDDEN.has(cell.column.id)
                  return (
                    <TableCell
                      key={cell.id}
                      className={`py-3${isMobileHidden ? ' hidden lg:table-cell' : ''}`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('admin.members.pageInfo').replace('{{current}}', String(pageIndex + 1)).replace('{{total}}', String(totalPages))}</p>
          <div className="flex gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-40 hover:opacity-70 transition-opacity"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
            >{t('admin.members.btn.prev')}</button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-40 hover:opacity-70 transition-opacity"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
            >{t('admin.members.btn.next')}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── MembersTab ────────────────────────────────────────────────────────────────

export function MembersTab() {
  const { lang, t } = useLanguage()
  const qc = useQueryClient()
  const [denyNote, setDenyNote] = useState<Record<string, string>>({})
  const [showDenyInput, setShowDenyInput] = useState<Record<string, boolean>>({})

  const { data, isLoading } = useQuery<MembersData>({
    queryKey: ['admin-members-full'],
    queryFn: () => fetch('/api/admin/members').then(r => r.json()),
  })

  const verifyMutation = useMutation({
    mutationFn: ({ id, action, admin_note }: { id: string; action: 'approve' | 'deny'; admin_note?: string }) =>
      fetch(`/api/admin/members/verify/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, admin_note }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-members-full'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const promoteMutation = useMutation({
    mutationFn: ({ profileId, role }: { profileId: string; role: string }) =>
      fetch(`/api/admin/members/${profileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-members-full'] }),
  })

  const handlePromote = useCallback((profileId: string, role: string) => {
    promoteMutation.mutate({ profileId, role })
  }, [promoteMutation])

  const losMembers = data?.los_members ?? []
  const pendingVerifications = data?.pending_verifications ?? []
  const unverifiedGuests = data?.unverified_guests ?? []

  return (
    <div className="space-y-8">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {t('admin.members.summary.losLinked').replace('{{total}}', String(losMembers.length)).replace('{{linked}}', String(losMembers.filter(m => m.profile).length))}
      </p>

      {pendingVerifications.length > 0 && (
        <section>
          <p className="text-xs font-semibold tracking-widest uppercase mb-3 flex items-center gap-2"
            style={{ color: 'var(--text-secondary)' }}>
            {t('admin.members.pendingVerification')}
            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full text-white"
              style={{ backgroundColor: 'var(--brand-crimson)' }}>
              {pendingVerifications.length}
            </span>
          </p>
          <div className="space-y-2">
            {pendingVerifications.map(v => {
              const losMatch = losMembers.find(m => m.abo_number === v.claimed_abo)
              const uplineMatch = losMatch?.sponsor_abo_number === v.claimed_upline_abo
              const fullMatch = losMatch && uplineMatch
              return (
                <div key={v.id} className="rounded-2xl border shadow-sm p-4"
                  style={{ backgroundColor: 'var(--bg-card)', borderColor: fullMatch ? '#81b29a50' : '#f2cc8f80' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {v.profiles?.first_name} {v.profiles?.last_name}
                        </p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={fullMatch
                            ? { backgroundColor: '#81b29a33', color: '#2d6a4f' }
                            : { backgroundColor: '#f2cc8f33', color: '#7a5c00' }}>
                          {fullMatch ? t('admin.members.verify.losMatch') : losMatch ? t('admin.members.verify.uplineMismatch') : t('admin.members.verify.noAboInLos')}
                        </span>
                      </div>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {t('admin.members.verify.claimsAbo')} <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{v.claimed_abo}</span>{' · '}{t('admin.members.verify.upline')} <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{v.claimed_upline_abo}</span>
                      </p>
                      {losMatch && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                          {t('admin.members.verify.los')} <span style={{ color: 'var(--text-primary)' }}>{losMatch.name}</span>{' · '}{t('admin.members.verify.sponsorInLos')} <span style={{ color: uplineMatch ? '#2d6a4f' : 'var(--brand-crimson)' }}>
                            {losMatch.sponsor_abo_number ?? '—'}
                          </span>
                        </p>
                      )}
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{timeAgo(v.created_at)}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => verifyMutation.mutate({ id: v.id, action: 'approve' })}
                        disabled={verifyMutation.isPending}
                        className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                        style={{ backgroundColor: 'var(--brand-teal)' }}>{t('admin.members.verify.btn.approve')}</button>
                      {!showDenyInput[v.id] ? (
                        <button onClick={() => setShowDenyInput(s => ({ ...s, [v.id]: true }))}
                          className="px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
                          style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--text-primary)' }}>{t('admin.members.verify.btn.deny')}</button>
                      ) : (
                        <div className="flex gap-2 items-center">
                          <input value={denyNote[v.id] ?? ''}
                            onChange={e => setDenyNote(s => ({ ...s, [v.id]: e.target.value }))}
                            placeholder={t('admin.members.verify.reasonPlaceholder')}
                            className="border border-black/10 rounded-lg px-2 py-1 text-xs w-36"
                            style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
                          <button onClick={() => verifyMutation.mutate({ id: v.id, action: 'deny', admin_note: denyNote[v.id] })}
                            disabled={verifyMutation.isPending}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                            style={{ backgroundColor: 'var(--brand-crimson)' }}>{t('admin.members.verify.btn.confirm')}</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {unverifiedGuests.length > 0 && (
        <section>
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>
            {t('admin.members.guestsNoAbo').replace('{{count}}', String(unverifiedGuests.length))}
          </p>
          <div className="rounded-2xl border shadow-sm divide-y" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            {unverifiedGuests.map(g => (
              <div key={g.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{g.first_name} {g.last_name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{t('admin.members.guestJoined')} {timeAgo(g.created_at)}</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--text-secondary)' }}>{t('admin.members.guestRole')}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>
          {t('admin.members.losMapDesc').replace('{{count}}', String(losMembers.length))}
        </p>
        <LosTable
          members={losMembers}
          isLoading={isLoading}
          onPromote={handlePromote}
          promotePending={promoteMutation.isPending}
        />
      </section>
    </div>
  )
}
