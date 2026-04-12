'use client'

import { useState, useRef } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

type NewMember   = { abo_number: string; name: string; abo_level: string }
type LevelChange = { abo_number: string; name: string; prev_level: string; new_level: string }
type BonusChange = { abo_number: string; name: string; prev_bonus: number; new_bonus: number }

type UnrecognizedRow = {
  abo_number: string
  name: string
  sponsor_abo_number: string | null
}

type ManualMemberNoAbo = {
  id: string
  first_name: string
  last_name: string
  upline_abo_number: string | null
}

type ImportResult = {
  inserted: number
  errors: { abo_number: string; error: string }[]
  diff: {
    new_members:   NewMember[]
    level_changes: LevelChange[]
    bonus_changes: BonusChange[]
  }
  unrecognized: UnrecognizedRow[]
  manual_members_no_abo: ManualMemberNoAbo[]
}

// ── CSV helpers ───────────────────────────────────────────────────────────────

const HEADER_MAP: Record<string, string> = {
  'ABO Level': 'abo_level', 'Sponsor ABO Number': 'sponsor_abo_number',
  'ABO Number': 'abo_number', 'Country': 'country', 'Name': 'name',
  'Entry Date': 'entry_date', 'Phone': 'phone', 'Email': 'email',
  'Address': 'address', 'Renewal Date': 'renewal_date', 'GPV': 'gpv',
  'PPV': 'ppv', 'Bonus Percent': 'bonus_percent', 'GBV': 'gbv',
  'Customer PV': 'customer_pv', 'Ruby PV': 'ruby_pv', 'Customers': 'customers',
  ' Customers': 'customers', 'Points to Next level': 'points_to_next_level',
  'Qualified Legs': 'qualified_legs', 'Group Size': 'group_size',
  'Personal Order Count': 'personal_order_count', 'Group Orders Count': 'group_orders_count',
  'Sponsoring': 'sponsoring', 'Annual PPV': 'annual_ppv',
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
  const cleaned = text.replace(/^\uFEFF/, '') // strip Excel BOM
  const allLines = cleaned.trim().split('\n')
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

// ── ReconciliationPanel ───────────────────────────────────────────────────────

function ReconciliationPanel({
  initialUnrecognized, initialProfiles,
}: { initialUnrecognized: UnrecognizedRow[]; initialProfiles: ManualMemberNoAbo[] }) {
  const [unrecognized, setUnrecognized] = useState(initialUnrecognized)
  const [profiles, setProfiles] = useState(initialProfiles)
  const [selectedLos, setSelectedLos] = useState<string | null>(null)
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)

  if (unrecognized.length === 0 && profiles.length === 0) return null

  const selectedLosRow = unrecognized.find(r => r.abo_number === selectedLos) ?? null

  async function handleLink() {
    if (!selectedProfileId || !selectedLos || !selectedLosRow) return
    setLinking(true)
    setLinkError(null)
    try {
      const res = await fetch(`/api/admin/members/${selectedProfileId}/assign-abo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ abo_number: selectedLosRow.abo_number, sponsor_abo_number: selectedLosRow.sponsor_abo_number ?? null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Link failed')
      setUnrecognized(prev => prev.filter(r => r.abo_number !== selectedLos))
      setProfiles(prev => prev.filter(p => p.id !== selectedProfileId))
      setSelectedLos(null)
      setSelectedProfileId(null)
    } catch (err: unknown) {
      setLinkError(err instanceof Error ? err.message : 'Link failed')
    } finally {
      setLinking(false)
    }
  }

  return (
    <div className="mt-6 p-5 rounded-2xl border" style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-card)' }}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Reconciliation</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Match unrecognized LOS members to manually-verified portal profiles.
          </p>
        </div>
        {selectedLos && selectedProfileId && (
          <button onClick={handleLink} disabled={linking}
            className="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--brand-teal)' }}>
            {linking ? 'Linking…' : 'Link'}
          </button>
        )}
      </div>
      {linkError && <p className="text-xs mb-3" style={{ color: 'var(--brand-crimson)' }}>{linkError}</p>}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>
            Unrecognized in LOS — {unrecognized.length}
          </p>
          {unrecognized.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>All LOS members matched.</p>
          ) : (
            <div className="space-y-1.5">
              {unrecognized.map(row => (
                <button key={row.abo_number}
                  onClick={() => setSelectedLos(s => s === row.abo_number ? null : row.abo_number)}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-xs transition-colors"
                  style={{
                    backgroundColor: selectedLos === row.abo_number ? 'rgba(62,119,133,0.15)' : 'rgba(0,0,0,0.03)',
                    border: `1px solid ${selectedLos === row.abo_number ? '#3E7785' : 'transparent'}`,
                  }}>
                  <span className="font-mono font-medium block" style={{ color: 'var(--text-primary)' }}>{row.abo_number}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{row.name}</span>
                  {row.sponsor_abo_number && (
                    <span className="block mt-0.5" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>Sponsor {row.sponsor_abo_number}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>
            No ABO — awaiting position — {profiles.length}
          </p>
          {profiles.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>No manually-verified members without ABO.</p>
          ) : (
            <div className="space-y-1.5">
              {profiles.map(p => (
                <button key={p.id}
                  onClick={() => setSelectedProfileId(s => s === p.id ? null : p.id)}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-xs transition-colors"
                  style={{
                    backgroundColor: selectedProfileId === p.id ? 'rgba(62,119,133,0.15)' : 'rgba(0,0,0,0.03)',
                    border: `1px solid ${selectedProfileId === p.id ? '#3E7785' : 'transparent'}`,
                  }}>
                  <span className="font-medium block" style={{ color: 'var(--text-primary)' }}>{p.first_name} {p.last_name}</span>
                  {p.upline_abo_number && (
                    <span style={{ color: 'var(--text-secondary)' }}>Upline {p.upline_abo_number}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── DataCenterTab ─────────────────────────────────────────────────────────────

export function DataCenterTab() {
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
      const text = (ev.target?.result as string).replace(/^\uFEFF/, '') // strip Excel BOM
      const rows = parseCSV(text)
      if (rows.length === 0) {
        setError('Could not parse CSV — "ABO Number" column not found. Check the file header.')
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
      const res = await fetch('/api/admin/los-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsedRows }),
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
    <div className="space-y-6">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        LOS CSV import — upserts on ABO number. Rebuilds LTree paths after every import.
      </p>
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
          <DiffSection title="Level changes" count={result.diff.level_changes.length} color="#3d405b">
            {result.diff.level_changes.map(m => (
              <div key={m.abo_number} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg" style={{ backgroundColor: '#3d405b10' }}>
                <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{m.abo_number}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{m.name}</span>
                <span className="ml-auto font-semibold" style={{ color: 'var(--text-primary)' }}>{m.prev_level} → {m.new_level}</span>
              </div>
            ))}
          </DiffSection>
          <DiffSection title="Bonus % changes" count={result.diff.bonus_changes.length} color="#e07a5f">
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
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--brand-crimson)' }}>{result.errors.length} errors:</p>
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
