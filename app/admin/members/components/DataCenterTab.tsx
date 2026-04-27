'use client'

import { useState, useRef } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { apiClient } from '@/lib/apiClient'
import { parseCSV, type ImportResult } from '@/lib/csv-import'
import { ReconciliationPanel } from './ReconciliationPanel'

// ── DiffSection ───────────────────────────────────────────────────────────────

function DiffSection({
  title, count, color, children,
}: { title: string; count: number; color: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(count <= 5)
  if (count === 0) return null
  return (
    <div className="mt-4">
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 w-full text-left">
        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full"
          style={{ backgroundColor: color + '20', color }}>{count}</span>
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="ml-auto"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && <div className="mt-2 space-y-1">{children}</div>}
    </div>
  )
}

// ── DataCenterTab ─────────────────────────────────────────────────────────────

export function DataCenterTab() {
  const { t } = useLanguage()
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([])
  const [preview, setPreview] = useState<Record<string, string>[]>([])
  const [filename, setFilename] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFilename(file.name)
    setResult(null)
    setError(null)
    setParsedRows([])
    setPreview([])
    const reader = new FileReader()
    reader.onload = ev => {
      const text = (ev.target?.result as string).replace(/^\uFEFF/, '')
      const rows = parseCSV(text)
      if (rows.length === 0) {
        setError('Could not parse CSV — header row not found. Check that the file is a valid LOS export.')
        return
      }
      setParsedRows(rows)
      setPreview(rows.slice(0, 5))
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!parsedRows.length) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await apiClient<ImportResult>('/api/admin/los-import', {
        method: 'POST',
        body: JSON.stringify({ rows: parsedRows }),
      })
      setResult(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('admin.data.title')}</p>
      <div className="border-2 border-dashed rounded-lg p-8 text-center" style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-card)' }}>
        <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" id="csv-upload" />
        <label htmlFor="csv-upload" className="cursor-pointer">
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{filename ? filename : 'Click to select a CSV file'}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{preview.length > 0 ? `${parsedRows.length} rows detected` : '.csv only'}</p>
        </label>
      </div>
      {preview.length > 0 && (
        <div className="overflow-x-auto">
          <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>Preview (first 5 rows)</p>
          <table className="text-xs w-full border-collapse">
            <thead>
              <tr>
                {Object.keys(preview[0]).map(k => (
                  <th key={k} className="border px-2 py-1 text-left font-medium" style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)' }}>{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i}>
                  {Object.values(row).map((v, j) => (
                    <td key={j} className="border px-2 py-1 truncate max-w-24" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {preview.length > 0 && (
        <button onClick={handleImport} disabled={loading}
          className="bg-[#bc4749] text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
          {loading ? 'Importing...' : 'Run Import'}
        </button>
      )}
      {result && (
        <div className="p-5 rounded-2xl border" style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-card)' }}>
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Import complete — {result.inserted} rows upserted
            </p>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#81b29a20', color: '#2d6a4f' }}>
              {result.diff.new_members.length} new
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#3d405b20', color: '#3d405b' }}>
              {result.diff.level_changes.length} level changes
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#e07a5f20', color: '#e07a5f' }}>
              {result.diff.bonus_changes.length} bonus changes
            </span>
            {result.errors.length > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(188,71,73,0.12)', color: '#bc4749' }}>
                {result.errors.length} errors
              </span>
            )}
          </div>
          <DiffSection title="New members" count={result.diff.new_members.length} color="#81b29a">
            {result.diff.new_members.map(m => (
              <div key={m.abo_number} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg" style={{ backgroundColor: '#81b29a10' }}>
                <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{m.abo_number}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{m.name}</span>
                <span className="ml-auto font-semibold" style={{ color: '#2d6a4f' }}>Level {m.abo_level}</span>
              </div>
            ))}
          </DiffSection>
          <DiffSection title={t('admin.data.result.levelChangesTitle')} count={result.diff.level_changes.length} color="#3d405b">
            {result.diff.level_changes.map(m => (
              <div key={m.abo_number} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg" style={{ backgroundColor: '#3d405b10' }}>
                <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{m.abo_number}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{m.name}</span>
                <span className="ml-auto font-semibold" style={{ color: 'var(--text-primary)' }}>{m.prev_level} → {m.new_level}</span>
              </div>
            ))}
          </DiffSection>
          <DiffSection title={t('admin.data.result.bonusChangesTitle')} count={result.diff.bonus_changes.length} color="#e07a5f">
            {result.diff.bonus_changes.map(m => (
              <div key={m.abo_number} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg" style={{ backgroundColor: '#e07a5f10' }}>
                <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{m.abo_number}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{m.name}</span>
                <span className="ml-auto font-semibold" style={{ color: m.new_bonus > m.prev_bonus ? '#2d6a4f' : '#bc4749' }}>
                  {m.prev_bonus}% → {m.new_bonus}%
                </span>
              </div>
            ))}
          </DiffSection>
          {result.errors.length > 0 && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-default)' }}>
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--brand-crimson)' }}>{t('admin.data.result.rowErrorsTitle').replace('{{count}}', String(result.errors.length))}</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs" style={{ color: 'var(--brand-crimson)' }}>{e.abo_number}: {e.error}</p>
              ))}
            </div>
          )}
        </div>
      )}
      {result && (result.unrecognized.length > 0 || result.manual_members_no_abo.length > 0) && (
        <ReconciliationPanel
          initialUnrecognized={result.unrecognized}
          initialProfiles={result.manual_members_no_abo}
        />
      )}
      {error && (
        <div className="p-4 rounded-lg border" style={{ backgroundColor: 'rgba(188,71,73,0.06)', borderColor: 'rgba(188,71,73,0.3)' }}>
          <p className="text-sm" style={{ color: 'var(--brand-crimson)' }}>{error}</p>
        </div>
      )}
    </div>
  )
}
