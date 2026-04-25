'use client'

import { useState, useRef, useEffect } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import type { Table } from '@tanstack/react-table'

// ── Constants ────────────────────────────────────────────────────────────────

const TOGGLEABLE_COLS = ['abo_number', 'sponsor_abo_number', 'abo_level', 'gpv', 'bonus_percent', 'group_size']

// ── Component ────────────────────────────────────────────────────────────────

export function MembersFilterBar<T>({
  table,
  globalFilter,
  onFilterChange,
}: {
  table: Table<T>
  globalFilter: string
  onFilterChange: (value: string) => void
}) {
  const { t } = useLanguage()
  const [colsOpen, setColsOpen] = useState(false)
  const colsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (colsRef.current && !colsRef.current.contains(e.target as Node)) {
        setColsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const COL_LABELS: Record<string, string> = {
    abo_number: t('admin.members.table.abo'),
    sponsor_abo_number: t('admin.members.table.sponsorAbo'),
    abo_level: t('admin.members.table.level'),
    gpv: t('admin.members.table.gpv'),
    bonus_percent: t('admin.members.table.bonus'),
    group_size: t('admin.members.table.group'),
  }

  return (
    <div className="flex items-center gap-3 mb-3 flex-wrap">
      <input
        value={globalFilter}
        onChange={e => onFilterChange(e.target.value)}
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
  )
}
