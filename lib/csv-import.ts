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
  import_id: string
  errors: { abo_number: string; error: string }[]
  diff: {
    new_members:    NewMember[]
    level_changes:  LevelChange[]
    bonus_changes:  BonusChange[]
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
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12',
  януари: '01', февруари: '02', март: '03', април: '04',
  май: '05', юни: '06', юли: '07', август: '08',
  септември: '09', октомври: '10', ноември: '11', декември: '12',
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
  let cleaned = val.replace(/^'+/, '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned
  cleaned = cleaned.replace(/\s*г\.?$/, '')
  const m = cleaned.match(/^(\d{1,2})\s+([A-Za-z\u0400-\u04FF]+)\s+(\d{4})$/)
  if (m) {
    const month = MONTH_MAP[m[2].toLowerCase()]
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
        // Strip Excel text-prefix apostrophe from every field before any other
        // transform — prevents corrupted abo_number lookups, date parse failures,
        // and numeric cast errors when Excel leaks its internal text-prefix char.
        let val = (values[i] ?? '').replace(/^'+/, '')
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
const CONFLICT_FIELDS = ['name', 'sponsor_abo_number']

/**
 * Assembles multiple parsed CSV file results into a single deduplicated row set.
 * Detects junction nodes, field conflicts, and disconnected subtrees.
 *
 * - Dedup by abo_number (first-seen wins)
 * - Junction: same ABO appears in >1 file (expected for multi-file imports)
 * - Conflict: same ABO with differing name or sponsor_abo_number — warning only,
 *   never blocks import. First-seen file wins.
 * - Disconnected file: a file that shares zero abo_number values with all other
 *   files — it is a genuinely isolated subtree with no join point.
 */
export function assembleFiles(
  fileResults: { filename: string; rows: Record<string, string>[] }[]
): AssemblyResult {
  const seen = new Map<string, { row: Record<string, string>; filename: string }>()
  const filesByAbo = new Map<string, string[]>()
  const firstRowByAbo = new Map<string, Record<string, string>>()

  for (const { filename, rows } of fileResults) {
    for (const row of rows) {
      const abo = row.abo_number
      if (!abo) continue

      const existing = filesByAbo.get(abo) ?? []
      if (!existing.includes(filename)) existing.push(filename)
      filesByAbo.set(abo, existing)

      if (!seen.has(abo)) {
        seen.set(abo, { row, filename })
        firstRowByAbo.set(abo, row)
      }
    }
  }

  const rows = Array.from(seen.values()).map(v => v.row)

  // ── Junctions and conflicts ───────────────────────────────────────────────
  const junctions: JunctionNode[] = []
  const conflicts: JunctionNode[] = []

  for (const [abo, files] of filesByAbo.entries()) {
    if (files.length <= 1) continue

    const allRowsForAbo: Record<string, string>[] = []
    for (const { filename, rows: fileRows } of fileResults) {
      const match = fileRows.find(r => r.abo_number === abo)
      if (match) allRowsForAbo.push({ ...match, _filename: filename })
    }

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
  // A file is disconnected only if it shares zero abo_number values with ALL
  // other files combined. Having even one shared ABO means it connects.
  const disconnected_files: string[] = []

  if (fileResults.length > 1) {
    for (const { filename, rows: fileRows } of fileResults) {
      const fileAbos = new Set(fileRows.map(r => r.abo_number).filter(Boolean))

      // Collect all ABOs from every OTHER file
      const otherAbos = new Set<string>()
      for (const other of fileResults) {
        if (other.filename === filename) continue
        for (const r of other.rows) {
          if (r.abo_number) otherAbos.add(r.abo_number)
        }
      }

      // Disconnected = zero overlap
      const hasOverlap = [...fileAbos].some(abo => otherAbos.has(abo))
      if (!hasOverlap) disconnected_files.push(filename)
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

// ── Tree-root detection & scope check ───────────────────────────────────────────

/**
 * Returns the ABO numbers that are roots of the assembled row set — i.e. rows
 * whose sponsor_abo_number is empty or points to an ABO not present in the set.
 * A clean single sub-tree has exactly one root.
 */
export function findTreeRoots(rows: Record<string, string>[]): string[] {
  const abos = new Set(rows.map(r => r.abo_number).filter(Boolean))
  const roots: string[] = []
  const seen = new Set<string>()
  for (const r of rows) {
    const abo = r.abo_number
    if (!abo || seen.has(abo)) continue
    seen.add(abo)
    const sponsor = r.sponsor_abo_number
    if (!sponsor || !abos.has(sponsor)) roots.push(abo)
  }
  return roots
}

export type RootCheck =
  | { ok: true; root: string }
  | { ok: false; reason: 'no-root' | 'multi-root' | 'mismatch'; roots: string[] }

/**
 * Scope guard for a CORE submission (decision table from the plan):
 * - exactly 1 root that equals expectedAbo → ok
 * - 0 roots (cycle / self-referential export) → 'no-root'
 * - >1 root (multiple legs / upline row included) → 'multi-root'
 * - single root that is NOT expectedAbo → 'mismatch'
 * Enforced server-side; the client uses the same fn for early UX feedback.
 */
export function checkSubmissionRoot(
  rows: Record<string, string>[],
  expectedAbo: string
): RootCheck {
  const roots = findTreeRoots(rows)
  if (roots.length === 0) return { ok: false, reason: 'no-root', roots }
  if (roots.length > 1) return { ok: false, reason: 'multi-root', roots }
  if (roots[0] !== expectedAbo) return { ok: false, reason: 'mismatch', roots }
  return { ok: true, root: roots[0] }
}

// ── Multi-submission merge (deepest-owner-wins authority) ───────────────────────

export type SubmissionInput = {
  // A stable label for the owner of this submission — its root ABO. Surfaced in
  // junction metadata so the admin can see which owner won a contested node.
  rootAbo: string
  createdAt: string
  rows: Record<string, string>[]
}

/**
 * Merges multiple CORE submissions into one deduplicated row set.
 *
 * Authority rule (replaces assembleFiles' first-seen-wins): for any abo_number
 * present in more than one submission, the winning row comes from the submission
 * whose owner (rootAbo) sits DEEPEST in the combined sponsorship tree — i.e. the
 * most specific / closest-upline owner of that member. Ties break by newest
 * createdAt. The resolved single row set is what gets handed to import_los_members,
 * so DB-write correctness is unchanged; only which row wins per abo differs, and
 * it is surfaced via junction metadata rather than silent.
 */
export function mergeSubmissions(subs: SubmissionInput[]): AssemblyResult {
  // Union sponsor map (first-seen sponsor per abo) — used only for depth structure.
  const sponsorByAbo = new Map<string, string>()
  for (const sub of subs) {
    for (const row of sub.rows) {
      const abo = row.abo_number
      if (!abo || sponsorByAbo.has(abo)) continue
      sponsorByAbo.set(abo, row.sponsor_abo_number ?? '')
    }
  }

  // Depth of each abo from its top-most in-set ancestor (memoized, cycle-guarded).
  const depthCache = new Map<string, number>()
  function depthOf(abo: string, seen: Set<string>): number {
    const cached = depthCache.get(abo)
    if (cached !== undefined) return cached
    const parent = sponsorByAbo.get(abo)
    if (!parent || !sponsorByAbo.has(parent) || seen.has(abo)) {
      depthCache.set(abo, 0)
      return 0
    }
    seen.add(abo)
    const val = depthOf(parent, seen) + 1
    depthCache.set(abo, val)
    return val
  }

  // Winner selection per abo.
  type Cand = { row: Record<string, string>; rootDepth: number; createdAt: string; owner: string }
  const winner = new Map<string, Cand>()
  const ownersByAbo = new Map<string, string[]>()
  const rowsByAboBySub: { rootAbo: string; row: Record<string, string> }[] = []

  for (const sub of subs) {
    const rootDepth = depthOf(sub.rootAbo, new Set())
    for (const row of sub.rows) {
      const abo = row.abo_number
      if (!abo) continue

      const owners = ownersByAbo.get(abo) ?? []
      if (!owners.includes(sub.rootAbo)) owners.push(sub.rootAbo)
      ownersByAbo.set(abo, owners)
      rowsByAboBySub.push({ rootAbo: sub.rootAbo, row })

      const cur = winner.get(abo)
      if (
        !cur ||
        rootDepth > cur.rootDepth ||
        (rootDepth === cur.rootDepth && sub.createdAt > cur.createdAt)
      ) {
        winner.set(abo, { row, rootDepth, createdAt: sub.createdAt, owner: sub.rootAbo })
      }
    }
  }

  // Annotate each winning row with the owner (submission root) that won it, so
  // import_los_members can persist los_members.last_updated_by_abo.
  const rows = Array.from(winner.values()).map(c => ({ ...c.row, updated_by_abo: c.owner }))

  // Junctions: abo present in >1 submission. Conflict if name/sponsor differ.
  const junctions: JunctionNode[] = []
  const conflicts: JunctionNode[] = []
  for (const [abo, owners] of ownersByAbo.entries()) {
    if (owners.length <= 1) continue
    const allRows = rowsByAboBySub.filter(e => e.row.abo_number === abo).map(e => e.row)
    const ref = allRows[0]
    const conflictFields: string[] = []
    for (const field of CONFLICT_FIELDS) {
      const refVal = ref[field] ?? ''
      if (allRows.slice(1).some(r => (r[field] ?? '') !== refVal)) conflictFields.push(field)
    }
    const node: JunctionNode = {
      abo_number: abo,
      name: winner.get(abo)?.row.name ?? '',
      files: owners,
      has_conflict: conflictFields.length > 0,
      conflict_fields: conflictFields,
    }
    junctions.push(node)
    if (node.has_conflict) conflicts.push(node)
  }

  // Disconnected submission: shares zero abo_number with all others combined.
  const disconnected_files: string[] = []
  if (subs.length > 1) {
    for (const sub of subs) {
      const own = new Set(sub.rows.map(r => r.abo_number).filter(Boolean))
      const others = new Set<string>()
      for (const o of subs) {
        if (o === sub) continue
        for (const r of o.rows) if (r.abo_number) others.add(r.abo_number)
      }
      if (![...own].some(a => others.has(a))) disconnected_files.push(sub.rootAbo)
    }
  }

  return { rows, junctions, conflicts, disconnected_files, total_row_count: rows.length }
}
