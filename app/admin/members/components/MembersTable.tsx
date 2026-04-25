'use client'

import { useState, useCallback, useRef } from 'react'
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
import { MembersFilterBar } from './MembersFilterBar'
import type { LOSMember } from './MembersTab'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatNum(n: number) {
  return new Intl.NumberFormat('en-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

const LEVEL_BG: Record<string, { bg: string; color: string }> = {
  '1': { bg: 'var(--brand-forest)', color: 'white' },
  '2': { bg: 'var(--brand-crimson)', color: 'white' },
  '3': { bg: 'rgba(0,0,0,0.08)', color: 'var(--text-primary)' },
}

const MOBILE_HIDDEN = new Set(['gpv', 'bonus_percent', 'group_size', 'sponsor_abo_number'])

// ── Column definitions ───────────────────────────────────────────────────────

const colHelper = createColumnHelper<LOSMember>()

// ── Component ────────────────────────────────────────────────────────────────

export function MembersTable({
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
  const { t } = useLanguage()
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({ sponsor_abo_number: false })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedFilter, setDebouncedFilter] = useState('')

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
      <MembersFilterBar
        table={table}
        globalFilter={globalFilter}
        onFilterChange={handleSearch}
      />

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
