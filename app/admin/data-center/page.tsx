'use client'

import { useState, useRef } from 'react'

type ImportResult = {
  inserted: number
  errors: { abo_number: string; error: string }[]
}

// Expected CSV headers mapped to DB columns
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

// Parse a date like "31 December 2026" -> "2026-12-31"
function parseDate(val: string): string {
  if (!val) return ''
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
  const d = new Date(val)
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  return ''
}

function parseCSV(text: string): Record<string, string>[] {
  const allLines = text.trim().split('\n')

  // Find the header line — it's the first line that contains 'ABO Number'
  const headerIdx = allLines.findIndex(l => l.includes('ABO Number'))
  if (headerIdx === -1) return []

  const dataLines = allLines.slice(headerIdx)
  const headers = dataLines[0]
    .split(',')
    .map(h => h.trim().replace(/^"|"$/g, ''))

  return dataLines.slice(1)
    .filter(line => line.trim() !== '')
    .map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
      const row: Record<string, string> = {}
      headers.forEach((h, i) => {
        const dbKey = HEADER_MAP[h] ?? h.toLowerCase().replace(/\s+/g, '_')
        let val = values[i] ?? ''
        // Strip % from bonus_percent
        if (dbKey === 'bonus_percent') val = val.replace('%', '').trim()
        // Normalise dates
        if (dbKey === 'entry_date' || dbKey === 'renewal_date') val = parseDate(val)
        // Strip "Primary: " prefix from phone
        if (dbKey === 'phone') val = val.replace(/^Primary:\s*/i, '').trim()
        row[dbKey] = val
      })
      return row
    })
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
        <div className="mt-6 p-4 rounded-lg bg-green-50 border border-green-200">
          <p className="text-sm font-medium text-green-800">
            Import complete — {result.inserted} rows upserted
          </p>
          {result.errors.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-red-700 mb-1">{result.errors.length} errors:</p>
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