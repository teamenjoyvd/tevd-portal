'use client'

import Link from 'next/link'
import BentoCard from '@/components/bento/BentoCard'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { formatTime, calDay, calMonth } from '@/lib/format'

export type CalendarEvent = {
  id: string
  title: string
  start_time: string
  end_time: string | null
  event_type: string | null
}

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

type Props = {
  events?: CalendarEvent[]
  colSpan?: number
  mobileColSpan?: number
  rowSpan?: number
  style?: React.CSSProperties
}

export default function CalendarTile({ events = [], colSpan, mobileColSpan, rowSpan, style }: Props) {
  const { t } = useLanguage()

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
      style={{ animationDelay: '150ms', ...style }}
    >
      <div className="flex items-center justify-end mb-4">
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
        <div className="flex flex-col gap-3 flex-1">
          {events.map(event => {
            const duration = eventDuration(event.start_time, event.end_time)
            const typeParts = [
              event.event_type ? (EVENT_TYPE_LABELS[event.event_type] ?? event.event_type) : null,
              formatTime(event.start_time),
              duration || null,
            ].filter(Boolean).join(' · ')

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
                  </p>
                  {typeParts && (
                    <p className="font-body text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {typeParts}
                    </p>
                  )}
                </div>
                <div
                  className="flex flex-col items-center flex-shrink-0 rounded-lg overflow-hidden"
                  style={{ width: 40 }}
                >
                  <div
                    className="w-full text-center py-0.5"
                    style={{ backgroundColor: 'var(--brand-crimson)', flex: '0 0 33%' }}
                  >
                    <span
                      className="text-[8px] font-bold tracking-widest uppercase"
                      style={{ color: 'rgba(255,255,255,0.9)' }}
                    >
                      {calMonth(event.start_time)}
                    </span>
                  </div>
                  <div
                    className="w-full text-center"
                    style={{ backgroundColor: 'var(--bg-card)', flex: '0 0 67%', paddingTop: 3, paddingBottom: 4 }}
                  >
                    <span
                      className="font-display text-2xl font-bold leading-none"
                      style={{ color: 'var(--brand-crimson)' }}
                    >
                      {calDay(event.start_time)}
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
