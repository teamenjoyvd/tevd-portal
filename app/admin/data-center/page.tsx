'use client'

import React, { useState, useRef } from 'react'

type NewMember   = { abo_number: string; name: string; abo_level: string }
type LevelChange = { abo_number: string; name: string; prev_level: string; new_level: string }
type BonusChange = { abo_number: string; name: string; prev_bonus: number; new_bonus: number }

type ImportResult = {
  inserted: number
  errors: { abo_number: string; error: string }[]
  diff: {
    new_members:   NewMember[]
    level_changes: LevelChange[]
    bonus_changes: BonusChange[]
  }
}

const HEADER_MAP: Record<string, string> = {
  'ABO Level': 'abo_level',
  'Sponsor ABO Number': 'sponsor_abo_number',
  'ABO Number': 'abo_number',
  'Country': 'country',
  'Name': 'name',
  'Entry Date': 'entry_date',
  'Phone': 'phone',
  'Email': 'email',
  'Address': 'address',
  'Renewal Date': 'renewal_date',
  'GPV': 'gpv',
  'PPV': 'ppv',
  'Bonus Percent': 'bonus_percent',
  'GBV': 'gbv',
  'Customer PV': 'customer_pv',
  'Ruby PV': 'ruby_pv',
  'Customers': 'customers',
  ' Customers': 'customers',
  'Points to Next level': 'points_to_next_level',
  'Qualified Legs': 'qualified_legs',
  'Group Size': 'group_size',
  'Personal Order Count': 'personal_order_count',
  'Group Orders Count': 'group_orders_count',
  'Sponsoring': 'sponsoring',
  'Annual PPV': 'annual_ppv',
}

const MONTH_MAP: Record<string, string> = {
  January: '01', February: '02', March: '03', April: '04',
  May: '05', June: '06', July: '07', August: '08',
  September: '09', October: '10', November: '11', December: '12',
}

function parseDate(val: string): string {
  if (!val) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
  const m = val.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
  if (m) {
    const month = MONTH_MAP[m[2]]
    if (month) return `${m[3]}-${month}-${m[1].padStart(2, '0')}`
  }
  return ''
}

function splitCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function parseCSV(text: string): Record<string, string>[] {
  const allLines = text.trim().split('\n')
  const headerIdx = allLines.findIndex(l => l.includes('ABO Number'))
  if (headerIdx === -1) return []

  const dataLines = allLines.slice(headerIdx)
  const headers = splitCSVLine(dataLines[0])

  return dataLines.slice(1)
    .filter(line => line.trim() !== '')
    .map(line => {
      const values = splitCSVLine(line)
      const row: Record<string, string> = {}
      headers.forEach((h, i) => {
        const dbKey = HEADER_MAP[h] ?? h.toLowerCase().replace(/\s+/g, '_')
        let val = values[i] ?? ''
        if (dbKey === 'bonus_percent') val = val.replace('%', '').trim()
        if (dbKey === 'entry_date' || dbKey === 'renewal_date') val = parseDate(val)
        if (dbKey === 'phone') val = val.replace(/^Primary:\s*/i, '').trim()
        row[dbKey] = val
      })
      return row
    })
}

function DiffSection({
  title, count, color, children,
}: {
  title: string; count: number; color: string; children: React.ReactNode
}) {
  const [open, setOpen] = useState(count <= 5)
  if (count === 0) return null
  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left"
      >
        <span
          className="text-xs font-bold px-2.5 py-0.5 rounded-full"
          style={{ backgroundColor: color + '20', color }}
        >
          {count}
        </span>
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="ml-auto"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && <div className="mt-2 space-y-1">{children}</div>}
    </div>
  )
}

export default function DataCenterPage() {
  const fileRef = useRef<HTMLInputElement>(null)
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
    const reader = new FileReader()
    reader.onload = ev => {
      const rows = parseCSV(ev.target?.result as string)
      setPreview(rows.slice(0, 5))
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)

    const text = await file.text()
    const rows = parseCSV(text)

    try {
      const res = await fetch('/api/admin/los-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Import failed')
      setResult(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">Data Center</h1>
      <p className="text-sm text-gray-500 mb-6">
        LOS CSV import — upserts on ABO number. Rebuilds LTree paths after every import.
      </p>

      {/* Upload zone */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-6">
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={handleFile}
          className="hidden"
          id="csv-upload"
        />
        <label htmlFor="csv-upload" className="cursor-pointer">
          <p className="text-sm font-medium text-gray-700">
            {filename ? filename : 'Click to select a CSV file'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {preview.length > 0 ? `${preview.length}+ rows detected` : '.csv only'}
          </p>
        </label>
      </div>

      {/* Preview table */}
      {preview.length > 0 && (
        <div className="overflow-x-auto mb-6">
          <p className="text-xs text-gray-400 mb-2">Preview (first 5 rows)</p>
          <table className="text-xs w-full border-collapse">
            <thead>
              <tr>
                {Object.keys(preview[0]).map(k => (
                  <th key={k} className="border border-gray-200 px-2 py-1 bg-gray-50 text-left font-medium">
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i}>
                  {Object.values(row).map((v, j) => (
                    <td key={j} className="border border-gray-200 px-2 py-1 truncate max-w-24">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Import button */}
      {preview.length > 0 && (
        <button
          onClick={handleImport}
          disabled={loading}
          className="bg-[#bc4749] text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Importing...' : 'Run Import'}
        </button>
      )}

      {/* Result */}
      {result && (
        <div className="mt-6 p-5 rounded-2xl border" style={{ borderColor: 'rgba(0,0,0,0.07)', backgroundColor: 'white' }}>
          {/* Summary row */}
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Import complete — {result.inserted} rows upserted
            </p>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: '#81b29a20', color: '#2d6a4f' }}>
              {result.diff.new_members.length} new
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: '#3d405b20', color: '#3d405b' }}>
              {result.diff.level_changes.length} level changes
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: '#e07a5f20', color: '#e07a5f' }}>
              {result.diff.bonus_changes.length} bonus changes
            </span>
          </div>

          {/* New members */}
          <DiffSection title="New members" count={result.diff.new_members.length} color="#81b29a">
            {result.diff.new_members.map(m => (
              <div key={m.abo_number} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg"
                style={{ backgroundColor: '#81b29a10' }}>
                <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{m.abo_number}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{m.name}</span>
                <span className="ml-auto font-semibold" style={{ color: '#2d6a4f' }}>
                  Level {m.abo_level}
                </span>
              </div>
            ))}
          </DiffSection>

          {/* Level changes */}
          <DiffSection title="Level changes" count={result.diff.level_changes.length} color="#3d405b">
            {result.diff.level_changes.map(m => (
              <div key={m.abo_number} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg"
                style={{ backgroundColor: '#3d405b10' }}>
                <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{m.abo_number}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{m.name}</span>
                <span className="ml-auto font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {m.prev_level} → {m.new_level}
                </span>
              </div>
            ))}
          </DiffSection>

          {/* Bonus changes */}
          <DiffSection title="Bonus % changes" count={result.diff.bonus_changes.length} color="#e07a5f">
            {result.diff.bonus_changes.map(m => (
              <div key={m.abo_number} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg"
                style={{ backgroundColor: '#e07a5f10' }}>
                <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{m.abo_number}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{m.name}</span>
                <span className="ml-auto font-semibold"
                  style={{ color: m.new_bonus > m.prev_bonus ? '#2d6a4f' : '#bc4749' }}>
                  {m.prev_bonus}% → {m.new_bonus}%
                </span>
              </div>
            ))}
          </DiffSection>

          {/* Errors */}
          {result.errors.length > 0 && (
            <div className="mt-4 pt-4 border-t border-black/5">
              <p className="text-xs font-semibold text-red-700 mb-1">{result.errors.length} errors:</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-600">
                  {e.abo_number}: {e.error}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-6 p-4 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  )
}