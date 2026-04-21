// ── lib/format.ts — EET/EEST Regional Standards (ISS-0124) ─────────────────
// All date/time/currency formatting for the tevd-portal.
// Standards: Eastern European Time (EET/EEST), DD.MM.YYYY, 24h, EUR.
// timeZone is explicit on every formatter — Vercel server runs UTC; without
// this, server and client produce different strings → React hydration error #418.

import { TranslationKey } from '@/lib/i18n/translations'

export const TZ = 'Europe/Sofia'

/** 18.03.2026 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('bg-BG', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: TZ,
  })
}

/** Сряда, 18.03.2026 (weekday + full date, for event popups) */
export function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString('bg-BG', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: TZ,
  })
}

/** 14:30 (24h) */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('bg-BG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TZ,
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
    timeZone: TZ,
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
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short', timeZone: TZ }).toUpperCase()
}

/** Day number (no leading zero) for iOS-style date square */
export function calDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', timeZone: TZ })
}

/** 18 Mar 2026 — medium English date for admin/member-facing UI */
export function formatDateMediumEn(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: TZ,
  })
}

/** 18 March 2026 — long English date for profile / travel doc display */
export function formatDateLongEn(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: TZ,
  })
}

/**
 * Canonical relative-time formatter. Accepts an elapsed-ms diff and a typed
 * translation function. Handles clock skew (negative diff) and sub-minute
 * resolution via the 'home.time.justNow' key.
 *
 * Used by: SocialsTile (and any future component needing "X ago" strings).
 */
export function timeAgoMs(
  diff: number,
  t: (k: TranslationKey) => string,
): string {
  if (diff < 60000) return t('home.time.justNow')
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 60)  return `${mins}${t('home.time.minutesAgo')}`
  if (hours < 24) return `${hours}${t('home.time.hoursAgo')}`
  return `${days}${t('home.time.daysAgo')}`
}
