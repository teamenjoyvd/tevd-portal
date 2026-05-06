// Shared CSV import utilities for LOS data.
// Pure TypeScript — no 'use client' directive.

// ── Types ─────────────────────────────────────────────────────────────────────

export type NewMember   = { abo_number: string; name: string; abo_level: string }
export type LevelChange = { abo_number: string; name: string; prev_level: string; new_level: string }
export type BonusChange = { abo_number: string; name: string; prev_bonus: number; new_bonus: number }
export type RemovedMember = { abo_number: string; name: string }

export type UnrecognizedRow = {
  abo_number: string
  name: string
  sponsor_abo_number: string | null
}

export type ManualMemberNoAbo = {
  id: string
  first_name: string
  last_name: string
  upline_abo_number: string | null
}

export type JunctionNode = {
  abo_number: string
  name: string
  files: string[]
  has_conflict: boolean
  conflict_fields: string[]
}

export type AssemblyResult = {
  rows: Record<string, string>[]
  junctions: JunctionNode[]
  conflicts: JunctionNode[]
  disconnected_files: string[]
  total_row_count: number
}

export type ImportResult = {
  inserted: number
  removed: number
  import_id: string
  errors: { abo_number: string; error: string }[]
  diff: {
    new_members:    NewMember[]
    level_changes:  LevelChange[]
    bonus_changes:  BonusChange[]
    removed_members: RemovedMember[]
  }
  unrecognized: UnrecognizedRow[]
  manual_members_no_abo: ManualMemberNoAbo[]
}

// ── Header maps ───────────────────────────────────────────────────────────────

export const HEADER_MAP: Record<string, string> = {
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

export const HEADER_MAP_BG: Record<string, string> = {
  '\u041d\u0438\u0432\u043e \u043d\u0430 \u0421\u0411\u0410': 'abo_level',
  '\u041d\u043e\u043c\u0435\u0440 \u043d\u0430 \u0421\u043f\u043e\u043d\u0441\u043e\u0440\u0438\u0440\u0430\u0449\u0438\u044f \u0421\u0411\u0410': 'sponsor_abo_number',
  '\u041d\u043e\u043c\u0435\u0440 \u043d\u0430 \u0421\u0411\u0410': 'abo_number',
  '\u0414\u044a\u0440\u0436\u0430\u0432\u0430': 'country',
  '\u0418\u043c\u0435': 'name',
  '\u0414\u0430\u0442\u0430 \u043d\u0430 \u0432\u044a\u0432\u0435\u0436\u0434\u0430\u043d\u0435': 'entry_date',
  '\u0422\u0435\u043b\u0435\u0444\u043e\u043d': 'phone',
  '\u0415\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u043d\u0430 \u043f\u043e\u0449\u0430': 'email',
  '\u0410\u0434\u0440\u0435\u0441': 'address',
  '\u0414\u0430\u0442\u0430 \u043d\u0430 \u043f\u043e\u0434\u043d\u043e\u0432\u044f\u0432\u0430\u043d\u0435': 'renewal_date',
  '\u0413\u0422\u0421': 'gpv',
  '\u041b\u0422\u0421': 'ppv',
  '\u041f\u0440\u043e\u0446\u0435\u043d\u0442 \u043d\u0430 \u0432\u044a\u0437\u043d\u0430\u0433\u0440\u0430\u0436\u0434\u0435\u043d\u0438\u0435': 'bonus_percent',
  '\u0413\u0411\u041e': 'gbv',
  '\u041a\u043b\u0438\u0435\u043d\u0442\u0441\u043a\u0430 \u0422\u0421': 'customer_pv',
  '\u0422\u0421 \u0437\u0430 \u0420\u0443\u0431\u0438\u043d': 'ruby_pv',
  '\u041a\u043b\u0438\u0435\u043d\u0442\u0438': 'customers',
  '\u0422\u043e\u0447\u043a\u0438 \u0434\u043e \u0441\u043b\u0435\u0434\u0432\u0430\u0449\u043e\u0442\u043e \u043d\u0438\u0432\u043e': 'points_to_next_level',
  '\u041a\u0432\u0430\u043b\u0438\u0444\u0438\u0446\u0438\u0440\u0430\u043d\u0438 \u0437\u0432\u0435\u043d\u0430': 'qualified_legs',
  '\u0420\u0430\u0437\u043c\u0435\u0440 \u043d\u0430 \u0433\u0440\u0443\u043f\u0430': 'group_size',
  '\u0411\u0440\u043e\u0439 \u043b\u0438\u0447\u043d\u0438 \u043f\u043e\u0440\u044a\u0447\u043a\u0438': 'personal_order_count',
  '\u0411\u0440\u043e\u0439 \u0433\u0440\u0443\u043f\u043e\u0432\u0438 \u043f\u043e\u0440\u044a\u0447\u043a\u0438': 'group_orders_count',
  '\u0421\u043f\u043e\u043d\u0441\u043e\u0440\u0438\u0440\u0430\u043d\u0435': 'sponsoring',
  '\u0413\u043e\u0434\u0438\u0448\u043d\u0430 \u041b\u0422\u0421:': 'annual_ppv',
  '\u0422\u0421 \u043e\u0431\u0449\u043e \u0437\u0430 \u043e\u0440\u0433\u0430\u043d\u0438\u0437\u0430\u0446\u0438\u044f\u0442\u0430': 'org_total_pv',
}

export const NUMERIC_KEYS = new Set([
  'gpv', 'ppv', 'bonus_percent', 'gbv', 'customer_pv', 'ruby_pv',
  'customers', 'points_to_next_level', 'qualified_legs', 'group_size',
  'personal_order_count', 'group_orders_count', 'sponsoring', 'annual_ppv',
])

export const MONTH_MAP: Record<string, string> = {
  January: '01', February: '02', March: '03', April: '04',
  May: '05', June: '06', July: '07', August: '08',
  September: '09', October: '10', November: '11', December: '12',
}

// ── Parsing functions ─────────────────────────────────────────────────────────

export function sanitizeNumeric(val: string, isBG: boolean): string {
  // Strip Excel text-prefix apostrophe(s) — exported CSVs may leak the leading
  // single-quote Excel uses to force a cell to be stored as text (e.g. '850.18).
  // Must run first, before any locale-specific transforms.
  val = val.replace(/^'+/, '')
  if (isBG) {
    return val.replace(/[\u00A0\s]/g, '').replace(/,/g, '.')
  }
  return val.replace(/,/g, '')
}

export function parseDate(val: string): string {
  if (!val) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
  const m = val.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
  if (m) {
    const month = MONTH_MAP[m[2]]
    if (month) return `${m[3]}-${month}-${m[1].padStart(2, '0')}`
  }
  return ''
}

export function splitCSVLine(line: string): string[] {
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

export function parseCSV(text: string): Record<string, string>[] {
  const cleaned = text.replace(/^\uFEFF/, '')
  const allLines = cleaned.trim().split(/\r?\n/)

  const headerIdx = allLines.findIndex(
    l => l.includes('ABO Number') || l.includes('\u041d\u043e\u043c\u0435\u0440 \u043d\u0430 \u0421\u0411\u0410')
  )
  if (headerIdx === -1) return []

  const isBG = allLines[headerIdx].includes('\u041d\u043e\u043c\u0435\u0440 \u043d\u0430 \u0421\u0411\u0410')
  const activeMap = isBG ? HEADER_MAP_BG : HEADER_MAP

  const dataLines = allLines.slice(headerIdx)
  const headers = splitCSVLine(dataLines[0])

  return dataLines.slice(1)
    .filter(line => line.trim() !== '')
    .map(line => {
      const values = splitCSVLine(line)
      const row: Record<string, string> = {}
      headers.forEach((h, i) => {
        const dbKey = activeMap[h] ?? h.toLowerCase().replace(/\s+/g, '_')
        let val = values[i] ?? ''
        if (dbKey === 'bonus_percent') val = val.replace('%', '').trim()
        if (dbKey === 'entry_date' || dbKey === 'renewal_date') val = parseDate(val)
        if (dbKey === 'phone') val = val.replace(/^Primary:\s*/i, '').trim()
        if (NUMERIC_KEYS.has(dbKey)) val = sanitizeNumeric(val, isBG)
        row[dbKey] = val
      })
      return row
    })
}

// ── Multi-file assembly ───────────────────────────────────────────────────────

// String fields that count as a conflict when they differ between files
const CONFLICT_FIELDS = ['name', 'sponsor_abo_number', 'abo_level', 'country']

/**
 * Assembles multiple parsed CSV file results into a single deduplicated row set.
 * Detects junction nodes, field conflicts, and disconnected subtrees.
 *
 * - Dedup by abo_number (first-seen wins)
 * - Junction: same ABO appears in >1 file
 * - Conflict: same ABO, differing non-numeric fields between files
 * - Disconnected file: the root ABO of a file (its sponsor_abo_number) does not
 *   appear as an abo_number in any other file → subtree may be orphaned
 */
export function assembleFiles(
  fileResults: { filename: string; rows: Record<string, string>[] }[]
): AssemblyResult {
  // Map abo_number → { row, filename }
  const seen = new Map<string, { row: Record<string, string>; filename: string }>()
  // Track which filenames a given abo_number appeared in
  const filesByAbo = new Map<string, string[]>()
  // Track first-seen row per abo_number for conflict detection
  const firstRowByAbo = new Map<string, Record<string, string>>()

  for (const { filename, rows } of fileResults) {
    for (const row of rows) {
      const abo = row.abo_number
      if (!abo) continue

      // Track all filenames this ABO appeared in
      const existing = filesByAbo.get(abo) ?? []
      if (!existing.includes(filename)) existing.push(filename)
      filesByAbo.set(abo, existing)

      if (!seen.has(abo)) {
        // First-seen: record row and filename
        seen.set(abo, { row, filename })
        firstRowByAbo.set(abo, row)
      }
      // Subsequent occurrences: already deduplicated (first-seen wins)
    }
  }

  const allAbos = new Set(seen.keys())
  const rows = Array.from(seen.values()).map(v => v.row)

  // ── Junctions and conflicts ───────────────────────────────────────────────
  const junctions: JunctionNode[] = []
  const conflicts: JunctionNode[] = []

  for (const [abo, files] of filesByAbo.entries()) {
    if (files.length <= 1) continue

    // Find all rows for this ABO across files
    const allRowsForAbo: Record<string, string>[] = []
    for (const { filename, rows: fileRows } of fileResults) {
      const match = fileRows.find(r => r.abo_number === abo)
      if (match) allRowsForAbo.push({ ...match, _filename: filename })
    }

    // Detect conflicting fields
    const conflictFields: string[] = []
    const referenceRow = allRowsForAbo[0]
    for (const field of CONFLICT_FIELDS) {
      const refVal = referenceRow[field] ?? ''
      const hasConflict = allRowsForAbo.slice(1).some(r => (r[field] ?? '') !== refVal)
      if (hasConflict) conflictFields.push(field)
    }

    const node: JunctionNode = {
      abo_number: abo,
      name: firstRowByAbo.get(abo)?.name ?? '',
      files,
      has_conflict: conflictFields.length > 0,
      conflict_fields: conflictFields,
    }

    junctions.push(node)
    if (node.has_conflict) conflicts.push(node)
  }

  // ── Disconnected file detection ───────────────────────────────────────────
  // A file is disconnected if its root node (the ABO with no sponsor in the
  // assembled set) has a sponsor_abo_number that doesn't appear in any other file.
  const disconnected_files: string[] = []

  for (const { filename, rows: fileRows } of fileResults) {
    if (fileResults.length <= 1) break // single file: no connection to check

    // Find ABOs in this file whose sponsor is NOT in the assembled set
    const orphanedRoots = fileRows.filter(r => {
      const sponsor = r.sponsor_abo_number
      if (!sponsor) return false // true root, acceptable
      return !allAbos.has(sponsor)
    })

    // If all rows in the file have an orphaned root chain, flag as disconnected
    // Heuristic: if >50% of rows have an unresolved sponsor, it's disconnected
    if (orphanedRoots.length > 0 && orphanedRoots.length / fileRows.length > 0.5) {
      disconnected_files.push(filename)
    }
  }

  return {
    rows,
    junctions,
    conflicts,
    disconnected_files,
    total_row_count: rows.length,
  }
}
