// ── lib/format.ts — EET/EEST Regional Standards (ISS-0124) ─────────────────
// All date/time/currency formatting for the tevd-portal.
// Standards: Eastern European Time (EET/EEST), DD.MM.YYYY, 24h, EUR.

/** 18.03.2026 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('bg-BG', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** Сряда, 18.03.2026 (weekday + full date, for event popups) */
export function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString('bg-BG', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** 14:30 (24h) */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('bg-BG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/** 18.03.2026, 14:30 */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('bg-BG', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/** 1.234,00 € */
export function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

/** MAR (3-char uppercase month for iOS-style date square) */
export function calMonth(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()
}

/** Day number (no leading zero) for iOS-style date square */
export function calDay(iso: string): string {
  return String(new Date(iso).getDate())
}
