import type { LOSMember } from './types/members'

// ── Bulgarian date formatter ──────────────────────────────────────────────────

const BG_MONTHS = [
  '', 'януари', 'февруари', 'март', 'април', 'май', 'юни',
  'юли', 'август', 'септември', 'октомври', 'ноември', 'декември'
]

function formatDateBG(iso: string | null): string {
  if (!iso) return ''
  const [date] = iso.split('T')
  const parts = date.split('-')
  if (parts.length !== 3) return ''
  const [year, mm, dd] = parts
  const monthName = BG_MONTHS[parseInt(mm, 10)]
  return monthName ? `${parseInt(dd, 10)} ${monthName} ${year} г.` : ''
}

// ── Numeric formatters ────────────────────────────────────────────────────────

/** Comma decimal for ' prefixed fields (e.g. "'-27,29") */
function fmtComma(n: number | null): string {
  return (n ?? 0).toFixed(2).replace('.', ',')
}

/** Dot decimal for raw fields (e.g. "1049.35") */
function fmtDot(n: number | null): string {
  return String(n ?? 0)
}

/**
 * Text-prefix a non-empty value.
 *
 * Shaped by the Amway format, but it doubles as this export's formula-injection
 * guard: every user-controlled column below (name, email, address, phone, ABO
 * numbers, dates) goes through `tick`, so a value opening with `=`, `+`, `-`,
 * `@`, TAB or CR reaches the spreadsheet as text. The columns that skip `tick`
 * are the numeric ones, which must stay numeric — see `csvSafe` for the general
 * form of the same rule.
 */
function tick(v: string): string {
  return v !== '' ? `'${v}` : ''
}

// ── Column spec (exact Amway order) ───────────────────────────────────────────

const EXPORT_COLUMNS: { header: string; value: (m: LOSMember) => string }[] = [
  { header: 'Ниво на СБА',                       value: m => String(m.abo_level ?? '') },
  { header: 'Номер на Спонсориращия СБА',         value: m => tick(m.sponsor_abo_number ?? '') },
  { header: 'Номер на СБА',                       value: m => tick(m.abo_number) },
  { header: 'Държава',                            value: m => tick(m.country ?? '') },
  { header: 'Име',                                value: m => tick(m.name ?? '') },
  { header: 'Дата на въвеждане',                  value: m => tick(formatDateBG(m.entry_date)) },
  { header: 'Телефон',                            value: m => tick(m.phone ?? '') },
  { header: 'Електронна поща',                    value: m => tick(m.email ?? '') },
  { header: 'Адрес',                              value: m => tick(m.address ?? '') },
  { header: 'Дата на подновяване',                value: m => tick(formatDateBG(m.renewal_date)) },
  { header: 'ГТС',                               value: m => tick(fmtComma(m.gpv)) },
  { header: 'ЛТС',                               value: m => tick(fmtComma(m.ppv)) },
  { header: 'Върната ТС',                         value: () => '0' },
  { header: 'Процент на възнаграждение',          value: m => tick(`${Math.round(m.bonus_percent ?? 0)}%`) },
  { header: 'ГБО',                               value: m => fmtDot(m.gbv) },
  { header: 'Клиентска ТС',                      value: m => tick(fmtComma(m.customer_pv)) },
  { header: 'ТС за Рубин',                       value: m => fmtDot(m.ruby_pv) },
  { header: ' Клиенти',                           value: m => tick(String(m.customers ?? 0)) },
  { header: 'Точки до следващото ниво',           value: m => fmtDot(m.points_to_next_level) },
  { header: 'Квалифицирани звена',                value: m => String(m.qualified_legs ?? 0) },
  { header: 'Размер на група',                    value: m => tick(String(m.group_size ?? 0)) },
  { header: 'Брой лични поръчки',                 value: m => String(m.personal_order_count ?? 0) },
  { header: 'Брой групови поръчки',               value: m => String(m.group_orders_count ?? 0) },
  { header: 'Спонсориране',                       value: m => tick(String(m.sponsoring ?? 0)) },
  { header: 'Годишна ЛТС:',                      value: m => fmtDot(m.annual_ppv) },
  { header: 'ТС общо за организацията',           value: () => '0' },
]

// ── CSV builder ───────────────────────────────────────────────────────────────

export function csvQuote(value: string): string {
  // Escape any double-quotes inside the value, then wrap in double-quotes
  return `"${value.replace(/"/g, '""')}"`
}

/**
 * Neutralises a leading formula character.
 *
 * Excel, LibreOffice and Google Sheets evaluate a cell opening with `=`, `+`,
 * `-`, `@`, TAB or CR as a formula — quoting per RFC 4180 does not stop that,
 * because the quotes are consumed by the CSV parser before the spreadsheet ever
 * sees the value. A leading apostrophe forces the cell to text and is stripped
 * from the display, so the value still reads as written.
 *
 * Lives next to `csvQuote` so the repo's two exports share one rule rather than
 * growing two. Apply to user-controlled TEXT only: prefixing a number would
 * turn a numeric cell into text, which is why `buildMembersCSV`'s numeric
 * columns go through neither this nor `tick`.
 */
export function csvSafe(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

export function buildMembersCSV(members: LOSMember[]): string {
  const now = new Date()
  const period = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`

  const lines: string[] = []

  // Metadata row 1
  lines.push([
    csvQuote('Amway'),
    csvQuote('ПОВЕРИТЕЛНО - НАСТОЯЩИЯТ ОТЧЕТ СЪДЪРЖА ТЪРГОВСКИ ТАЙНИ НА AMWAY, В ТОВА ЧИСЛО НЕЙНАТА ИНФОРМАЦИЯ ЗА ЛС, ПОВЕРИТЕЛНА И СОБСТВЕНИЧЕСКА БИЗНЕС ИНФОРМАЦИЯ. ПОЛУЧАТЕЛЯТ/ПРЕГЛЕЖДАЩИЯТ Я СЕ СЪГЛАСЯВА ДА Я ПОДДЪРЖА В НАЙ-СТРИКТНА ПОВЕРИТЕЛНОСТ И ДА Я ИЗПОЛЗВА САМО КАКТО Е РАЗРЕШЕНО ПО ДОГОВОР С AMWAY.')
  ].join(','))

  // Metadata row 2
  lines.push([csvQuote('Период на възнаграждение'), csvQuote(period)].join(','))

  // Header row
  lines.push(EXPORT_COLUMNS.map(c => csvQuote(c.header)).join(','))

  // Data rows
  for (const m of members) {
    lines.push(EXPORT_COLUMNS.map(c => csvQuote(c.value(m))).join(','))
  }

  return '\uFEFF' + lines.join('\r\n') + '\r\n'  // BOM + CRLF
}
