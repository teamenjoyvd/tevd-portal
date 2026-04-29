'use client'

import { useMemo } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { DAYS_I18N } from '@/lib/i18n/translations'
import { type CalendarEvent } from '@/app/(dashboard)/calendar/types'
import {
  SOFIA_DATE_FMT,
  isoWeek,
  startOfWeek,
  addDays,
  sameDaySofia,
} from '@/app/(dashboard)/calendar/utils'
import { EventPill } from '@/app/(dashboard)/calendar/components/EventPill'

export function MonthView({
  current,
  events,
  onEventClick,
  onDayClick,
}: {
  current: Date
  events: CalendarEvent[]
  onEventClick: (id: string) => void
  onDayClick: (date: Date) => void
}) {
  const { lang, t } = useLanguage()
  const DAYS = DAYS_I18N[lang]
  const today = new Date()
  const firstOfMonth = new Date(current.getFullYear(), current.getMonth(), 1)
  const gridStart = startOfWeek(firstOfMonth)
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))

  // Pre-compute a map of Sofia-date-key → events to avoid O(N×M) filtering
  // inside the 42-cell render loop.
  const eventsBySofiaDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    events.forEach(e => {
      const key = new Date(e.start_time).toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })
      if (!map[key]) map[key] = []
      map[key].push(e)
    })
    return map
  }, [events])

  const eventsOnDay = (date: Date) => {
    const dateKey = SOFIA_DATE_FMT.format(date)
    return eventsBySofiaDate[dateKey] ?? []
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="grid grid-cols-[40px_repeat(7,1fr)] border-b border-black/5 flex-shrink-0">
        <div />
        {DAYS.map(d => (
          <div key={d} className="py-2 text-center text-xs font-semibold tracking-wide"
            style={{ color: 'var(--text-secondary)' }}>
            {d}
          </div>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {Array.from({ length: 6 }, (_, week) => {
          const weekDays = cells.slice(week * 7, week * 7 + 7)
          return (
            <div key={week}
              className="grid grid-cols-[40px_repeat(7,1fr)] border-b border-black/5"
              style={{ minHeight: 90 }}>
              <div className="flex items-start justify-center pt-2 flex-shrink-0">
                <span className="text-[10px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  W{isoWeek(weekDays[0])}
                </span>
              </div>
              {weekDays.map((date, di) => {
                const isToday = sameDaySofia(date, today)
                const isCurrentMonth = date.getMonth() === current.getMonth()
                const dayEvents = eventsOnDay(date)
                return (
                  <div
                    key={di}
                    onClick={() => onDayClick(date)}
                    className="border-l border-black/5 p-1 cursor-pointer hover:bg-black/[0.02] transition-colors overflow-hidden"
                    style={{ minHeight: 90 }}
                  >
                    <div className="flex justify-center mb-1">
                      <span
                        className="w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium flex-shrink-0"
                        style={{
                          backgroundColor: isToday ? 'var(--crimson)' : 'transparent',
                          color: isToday ? 'white' : isCurrentMonth ? 'var(--text-primary)' : 'var(--text-secondary)',
                          opacity: isCurrentMonth ? 1 : 0.4,
                        }}
                      >
                        {date.getDate()}
                      </span>
                    </div>
                    <div className="space-y-0.5 overflow-hidden">
                      {dayEvents.slice(0, 3).map(ev => (
                        <EventPill
                          key={ev.id}
                          event={ev}
                          compact
                          onClick={() => onEventClick(ev.id)}
                        />
                      ))}
                      {dayEvents.length > 3 && (
                        <p className="text-[10px] font-medium pl-1 truncate"
                          style={{ color: 'var(--text-secondary)' }}>
                          +{dayEvents.length - 3} {t('cal.moreEvents')}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
