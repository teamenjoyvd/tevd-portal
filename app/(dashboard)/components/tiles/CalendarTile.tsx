'use client'

import Link from 'next/link'
import BentoCard from '@/components/bento/BentoCard'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { formatTime, calDay, TZ } from '@/lib/format'

export type CalendarEvent = {
  id: string
  title: string
  start_time: string
  end_time: string | null
  event_type: string | null
}

// Module-level formatters — Intl construction is expensive; hoist out of render loop.
const monthFormatterEn = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: TZ })
const monthFormatterBg = new Intl.DateTimeFormat('bg-BG', { month: 'short', timeZone: TZ })

function eventDuration(startIso: string, endIso: string | null | undefined): string {
  if (!endIso) return ''
  const diffMs = new Date(endIso).getTime() - new Date(startIso).getTime()
  if (diffMs <= 0) return ''
  const totalMins = Math.round(diffMs / 60000)
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

/** Returns abbreviated month in the active locale, uppercase. e.g. "MAR" or "МАР" */
function calMonthLocale(iso: string, lang: 'en' | 'bg'): string {
  const formatter = lang === 'bg' ? monthFormatterBg : monthFormatterEn
  return formatter.format(new Date(iso)).toUpperCase()
}

/**
 * Days from now to event date in Europe/Sofia timezone.
 * Uses Sofia midnight on both sides to avoid time-of-day skew.
 * Negative = past, 0 = today, 1 = tomorrow.
 */
function daysUntil(iso: string): number {
  const toSofiaMidnightMs = (date: Date): number => {
    // Extract Sofia calendar date via Intl, then reconstruct as UTC midnight equivalent
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date)
    const y = Number(parts.find(p => p.type === 'year')!.value)
    const mo = Number(parts.find(p => p.type === 'month')!.value)
    const d = Number(parts.find(p => p.type === 'day')!.value)
    return Date.UTC(y, mo - 1, d)
  }
  return Math.floor(
    (toSofiaMidnightMs(new Date(iso)) - toSofiaMidnightMs(new Date())) / 86400000
  )
}

type Props = {
  events?: CalendarEvent[]
  colSpan?: number
  mobileColSpan?: number
  rowSpan?: number
  style?: React.CSSProperties
}

export default function CalendarTile({ events = [], colSpan, mobileColSpan, rowSpan, style }: Props) {
  const { lang, t } = useLanguage()

  const EVENT_TYPE_LABELS: Record<string, string> = {
    'in-person': t('home.cal.typeInPerson'),
    'online':    t('home.cal.typeOnline'),
    'hybrid':    t('home.cal.typeHybrid'),
  }

  return (
    <BentoCard
      variant="default"
      colSpan={colSpan}
      mobileColSpan={mobileColSpan}
      rowSpan={rowSpan}
      className="bento-tile flex flex-col"
      style={{ animationDelay: '150ms', paddingTop: 10, paddingBottom: 10, ...style }}
    >
      <div className="flex items-center justify-end mb-3">
        <Link href="/calendar" className="font-body text-[11px] font-bold tracking-widest uppercase pill-link-crimson">
          {t('home.cal.eventsLink')}
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="font-body text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('home.cal.noEvents')}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 flex-1">
          {events.map(event => {
            const duration = eventDuration(event.start_time, event.end_time)
            const typeParts = [
              event.event_type ? (EVENT_TYPE_LABELS[event.event_type] ?? event.event_type) : null,
              formatTime(event.start_time),
              duration || null,
            ].filter(Boolean).join(' · ')

            const days = daysUntil(event.start_time)
            const pipLabel = days === 0
              ? t('home.cal.today')
              : days === 1
                ? t('home.cal.tomorrow')
                : null

            const monthLabel = calMonthLocale(event.start_time, lang)
            const dayLabel = calDay(event.start_time)

            return (
              <Link
                key={event.id}
                href={`/calendar?event=${event.id}`}
                className="flex items-center justify-between gap-3 py-2 border-b last:border-0 hover:opacity-70 transition-opacity"
                style={{ borderColor: 'var(--border-default)', textDecoration: 'none' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
                    {event.title}
                    {pipLabel && (
                      <span
                        className="ml-1.5 text-[9px] font-bold tracking-widest align-middle"
                        style={{ color: '#bc4749' }}
                      >
                        {pipLabel}
                      </span>
                    )}
                  </p>
                  {typeParts && (
                    <p className="font-body text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {typeParts}
                    </p>
                  )}
                </div>

                {/* Date badge */}
                <div
                  className="flex flex-col items-center flex-shrink-0 rounded-md overflow-hidden"
                  style={{ width: 44, height: 52 }}
                >
                  {/* Month strip */}
                  <div
                    className="w-full text-center"
                    style={{ backgroundColor: 'var(--brand-crimson)', flex: '0 0 30%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <span
                      className="text-[10px] font-medium tracking-widest uppercase leading-none"
                      style={{ color: 'rgba(255,255,255,0.92)' }}
                    >
                      {monthLabel}
                    </span>
                  </div>
                  {/* 1px divider */}
                  <div style={{ height: 1, width: '100%', backgroundColor: 'var(--border-default)', flexShrink: 0 }} />
                  {/* Day number */}
                  <div
                    className="w-full text-center flex items-center justify-center"
                    style={{ backgroundColor: 'var(--bg-card)', flex: '1 1 0' }}
                  >
                    <span
                      className="font-display text-3xl font-black leading-none"
                      style={{ color: 'var(--brand-crimson)' }}
                    >
                      {dayLabel}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </BentoCard>
  )
}
