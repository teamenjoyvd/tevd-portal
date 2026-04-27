// Shared CSV import utilities for LOS data.
// Pure TypeScript — no 'use client' directive.

// ── Types ─────────────────────────────────────────────────────────────────────

export type NewMember   = { abo_number: string; name: string; abo_level: string }
export type LevelChange = { abo_number: string; name: string; prev_level: string; new_level: string }
export type BonusChange = { abo_number: string; name: string; prev_bonus: number; new_bonus: number }

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

export type ImportResult = {
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
  'Ниво на СБА': 'abo_level',
  'Номер на Спонсориращия СБА': 'sponsor_abo_number',
  'Номер на СБА': 'abo_number',
  'Държава': 'country',
  'Име': 'name',
  'Дата на въвеждане': 'entry_date',
  'Телефон': 'phone',
  'Електронна поща': 'email',
  'Адрес': 'address',
  'Дата на подновяване': 'renewal_date',
  'ГТС': 'gpv',
  'ЛТС': 'ppv',
  'Процент на възнаграждение': 'bonus_percent',
  'ГБО': 'gbv',
  'Клиентска ТС': 'customer_pv',
  'ТС за Рубин': 'ruby_pv',
  'Клиенти': 'customers',
  'Точки до следващото ниво': 'points_to_next_level',
  'Квалифицирани звена': 'qualified_legs',
  'Размер на група': 'group_size',
  'Брой лични поръчки': 'personal_order_count',
  'Брой групови поръчки': 'group_orders_count',
  'Спонсориране': 'sponsoring',
  'Годишна ЛТС:': 'annual_ppv',
  'ТС общо за организацията': 'org_total_pv',
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
    l => l.includes('ABO Number') || l.includes('Номер на СБА')
  )
  if (headerIdx === -1) return []

  const isBG = allLines[headerIdx].includes('Номер на СБА')
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
