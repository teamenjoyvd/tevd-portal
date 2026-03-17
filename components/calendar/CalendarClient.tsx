'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { DAYS_I18N, MONTHS_I18N } from '@/lib/i18n/translations'
import EventPopup from '@/components/events/EventPopup'

// ── Types ──────────────────────────────────────────────────────────────────

type CalendarEvent = {
  id: string
  title: string
  description: string | null
  start_time: string
  end_time: string
  category: 'N21' | 'Personal'
  event_type: 'in-person' | 'online' | 'hybrid' | null
  week_number: number
  visibility_roles: string[]
}

type View = 'month' | 'week' | 'day' | 'agenda'

type Props = {
  initialEvents: CalendarEvent[]
  initialMonth: string
  userRole: 'admin' | 'core' | 'member' | 'guest' | null
  userProfileId: string | null
  isAuthenticated: boolean
}

// ── Constants ──────────────────────────────────────────────────────────────

const HOURS  = Array.from({ length: 24 }, (_, i) => i)
const HOUR_HEIGHT = 60

const CATEGORY_COLOR: Record<string, { bg: string; text: string }> = {
  N21:      { bg: 'var(--forest)',  text: 'rgba(255,255,255,0.95)' },
  Personal: { bg: 'var(--sienna)', text: 'rgba(255,255,255,0.95)' },
}

// ── Helpers ────────────────────────────────────────────────────────────────

function isoWeek(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const w1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d.getTime() - w1.getTime()) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7)
}

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function toMonthParam(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function eventMinutesFromMidnight(iso: string): number {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

function eventDurationMinutes(start: string, end: string): number {
  return Math.max(30, (new Date(end).getTime() - new Date(start).getTime()) / 60000)
}

// ── Event pill ─────────────────────────────────────────────────────────────

function EventPill({
  event, onClick, compact = false,
}: {
  event: CalendarEvent
  onClick: (rect: DOMRect) => void
  compact?: boolean
}) {
  const c = CATEGORY_COLOR[event.category]
  return (
    <button
      onClick={e => {
        e.stopPropagation()
        onClick(e.currentTarget.getBoundingClientRect())
      }}
      className="w-full text-left rounded-md px-1.5 transition-opacity hover:opacity-80 active:opacity-60"
      style={{
        backgroundColor: c.bg,
        color: c.text,
        fontSize: compact ? '10px' : '11px',
        fontWeight: 500,
        lineHeight: compact ? '18px' : '20px',
        minHeight: compact ? '18px' : '20px',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        display: 'block',
        maxWidth: '100%',
      }}
    >
      {compact ? event.title : `${formatTime(event.start_time)} ${event.title}`}
    </button>
  )
}

// ── Month View ─────────────────────────────────────────────────────────────

function MonthView({
  current, events, onEventClick, onDayClick,
}: {
  current: Date
  events: CalendarEvent[]
  onEventClick: (id: string, rect: DOMRect) => void
  onDayClick: (date: Date) => void
}) {
  const { lang } = useLanguage()
  const DAYS = DAYS_I18N[lang]
  const today = new Date()
  const firstOfMonth = new Date(current.getFullYear(), current.getMonth(), 1)
  const gridStart = startOfWeek(firstOfMonth)
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))

  const eventsOnDay = (date: Date) =>
    events.filter(e => sameDay(new Date(e.start_time), date))

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Day headers */}
      <div className="grid grid-cols-[40px_repeat(7,1fr)] border-b border-black/5 flex-shrink-0">
        <div />
        {DAYS.map(d => (
          <div key={d} className="py-2 text-center text-xs font-semibold tracking-wide"
            style={{ color: 'var(--text-secondary)' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
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
                const isToday = sameDay(date, today)
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
                          onClick={(rect) => onEventClick(ev.id, rect)}
                        />
                      ))}
                      {dayEvents.length > 3 && (
                        <p className="text-[10px] font-medium pl-1 truncate"
                          style={{ color: 'var(--text-secondary)' }}>
                          +{dayEvents.length - 3} more
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

// ── Week View ──────────────────────────────────────────────────────────────

function WeekView({
  current, events, onEventClick,
}: {
  current: Date
  events: CalendarEvent[]
  onEventClick: (id: string, rect: DOMRect) => void
}) {
  const { lang } = useLanguage()
  const DAYS = DAYS_I18N[lang]
  const today = new Date()
  const weekStart = startOfWeek(current)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const eventsOnDay = (date: Date) =>
    events.filter(e => sameDay(new Date(e.start_time), date))

  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (scrollRef.current) {
      const hour = new Date().getHours()
      scrollRef.current.scrollTop = Math.max(0, (hour - 1) * HOUR_HEIGHT)
    }
  }, [])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-black/5 flex-shrink-0">
        <div />
        {days.map((d, i) => {
          const isToday = sameDay(d, today)
          return (
            <div key={i} className="py-2 text-center border-l border-black/5">
              <p className="text-[10px] font-semibold tracking-wide uppercase"
                style={{ color: 'var(--text-secondary)' }}>
                {DAYS[i]}
              </p>
              <span
                className="w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mx-auto mt-0.5"
                style={{
                  backgroundColor: isToday ? 'var(--crimson)' : 'transparent',
                  color: isToday ? 'white' : 'var(--text-primary)',
                }}
              >
                {d.getDate()}
              </span>
            </div>
          )
        })}
      </div>
      <div ref={scrollRef} className="overflow-y-auto" style={{ height: 'calc(100vh - 320px)', minHeight: 300 }}>
        <div className="grid grid-cols-[48px_repeat(7,1fr)]"
          style={{ height: HOUR_HEIGHT * 24 }}>
          <div>
            {HOURS.map(h => (
              <div key={h} style={{ height: HOUR_HEIGHT }}
                className="flex items-start justify-end pr-2 pt-1">
                {h > 0 && (
                  <span className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {String(h).padStart(2, '0')}:00
                  </span>
                )}
              </div>
            ))}
          </div>
          {days.map((date, di) => {
            const dayEvents = eventsOnDay(date)
            return (
              <div key={di} className="relative border-l border-black/5"
                style={{ height: HOUR_HEIGHT * 24 }}>
                {HOURS.map(h => (
                  <div key={h} className="absolute w-full border-t border-black/[0.04]"
                    style={{ top: h * HOUR_HEIGHT }} />
                ))}
                {HOURS.map(h => (
                  <div key={`h-${h}`} className="absolute w-full border-t border-black/[0.02]"
                    style={{ top: h * HOUR_HEIGHT + HOUR_HEIGHT / 2 }} />
                ))}
                {dayEvents.map(ev => {
                  const top    = (eventMinutesFromMidnight(ev.start_time) / 60) * HOUR_HEIGHT
                  const height = Math.max(22,
                    (eventDurationMinutes(ev.start_time, ev.end_time) / 60) * HOUR_HEIGHT)
                  const c = CATEGORY_COLOR[ev.category]
                  return (
                    <button
                      key={ev.id}
                      onClick={e => { e.stopPropagation(); onEventClick(ev.id, e.currentTarget.getBoundingClientRect()) }}
                      className="absolute left-0.5 right-0.5 rounded-md px-1.5 text-left overflow-hidden hover:opacity-80 transition-opacity"
                      style={{ top: top + 1, height: height - 2, backgroundColor: c.bg, color: c.text, zIndex: 1 }}
                    >
                      <p className="text-[10px] font-semibold truncate leading-tight mt-0.5">
                        {ev.title}
                      </p>
                      {height > 36 && (
                        <p className="text-[9px] opacity-80 leading-tight">
                          {formatTime(ev.start_time)}
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Day View ───────────────────────────────────────────────────────────────

function DayView({
  current, events, onEventClick,
}: {
  current: Date
  events: CalendarEvent[]
  onEventClick: (id: string, rect: DOMRect) => void
}) {
  const dayEvents = events.filter(e => sameDay(new Date(e.start_time), current))

  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (scrollRef.current) {
      const hour = new Date().getHours()
      scrollRef.current.scrollTop = Math.max(0, (hour - 1) * HOUR_HEIGHT)
    }
  }, [])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-4 py-3 border-b border-black/5 flex-shrink-0">
        <p className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          {current.toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long',
          })}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          W{isoWeek(current)}
        </p>
      </div>
      <div ref={scrollRef} className="overflow-y-auto" style={{ height: 'calc(100vh - 320px)', minHeight: 300 }}>
        <div className="grid grid-cols-[48px_1fr]" style={{ height: HOUR_HEIGHT * 24 }}>
          <div>
            {HOURS.map(h => (
              <div key={h} style={{ height: HOUR_HEIGHT }}
                className="flex items-start justify-end pr-2 pt-1">
                {h > 0 && (
                  <span className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {String(h).padStart(2, '0')}:00
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="relative border-l border-black/5" style={{ height: HOUR_HEIGHT * 24 }}>
            {HOURS.map(h => (
              <div key={h} className="absolute w-full border-t border-black/[0.04]"
                style={{ top: h * HOUR_HEIGHT }} />
            ))}
            {HOURS.map(h => (
              <div key={`h-${h}`} className="absolute w-full border-t border-black/[0.02]"
                style={{ top: h * HOUR_HEIGHT + HOUR_HEIGHT / 2 }} />
            ))}
            {dayEvents.map(ev => {
              const top    = (eventMinutesFromMidnight(ev.start_time) / 60) * HOUR_HEIGHT
              const height = Math.max(28,
                (eventDurationMinutes(ev.start_time, ev.end_time) / 60) * HOUR_HEIGHT)
              const c = CATEGORY_COLOR[ev.category]
              return (
                <button
                  key={ev.id}
                  onClick={e => onEventClick(ev.id, e.currentTarget.getBoundingClientRect())}
                  className="absolute left-1 right-1 rounded-lg px-3 text-left overflow-hidden hover:opacity-80 transition-opacity"
                  style={{ top: top + 1, height: height - 2, backgroundColor: c.bg, color: c.text }}
                >
                  <p className="text-xs font-semibold truncate mt-1">{ev.title}</p>
                  {height > 44 && (
                    <p className="text-[10px] opacity-80">
                      {formatTime(ev.start_time)} – {formatTime(ev.end_time)}
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Agenda View ────────────────────────────────────────────────────────────

function AgendaView({
  events, onEventClick,
}: {
  events: CalendarEvent[]
  onEventClick: (id: string, rect: DOMRect) => void
}) {
  const { t } = useLanguage()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const grouped = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    events
      .filter(e => new Date(e.start_time) >= today)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      .forEach(e => {
        const key = new Date(e.start_time).toDateString()
        if (!map[key]) map[key] = []
        map[key].push(e)
      })
    return map
  }, [events])

  const dates = Object.keys(grouped)

  if (dates.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('cal.noEvents')}</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-2">
      {dates.map(dateKey => {
        const date = new Date(dateKey)
        const isToday = sameDay(date, new Date())
        return (
          <div key={dateKey} className="mb-6">
            <div className="flex items-center gap-3 mb-2 sticky top-0 py-2" style={{ backgroundColor: 'var(--bg-global)' }}>
              <div
                className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: isToday ? 'var(--crimson)' : 'rgba(0,0,0,0.06)',
                  color: isToday ? 'white' : 'var(--text-primary)',
                }}
              >
                {formatShortDate(date)}
              </div>
              <span className="text-[10px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                W{isoWeek(date)}
              </span>
            </div>
            <div className="space-y-2">
              {grouped[dateKey].map(ev => {
                const c = CATEGORY_COLOR[ev.category]
                return (
                  <button
                    key={ev.id}
                    onClick={e => onEventClick(ev.id, e.currentTarget.getBoundingClientRect())}
                    className="w-full text-left rounded-xl border border-black/5 overflow-hidden hover:shadow-sm transition-shadow flex"
                    style={{ backgroundColor: 'var(--bg-card)' }}
                  >
                    <div className="w-1 flex-shrink-0" style={{ backgroundColor: c.bg }} />
                    <div className="flex-1 px-4 py-3 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                          {ev.title}
                        </p>
                        <span className="text-xs flex-shrink-0 font-medium"
                          style={{ color: 'var(--text-secondary)' }}>
                          {formatTime(ev.start_time)}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {formatTime(ev.start_time)} – {formatTime(ev.end_time)}
                        {' · '}
                        <span style={{ color: c.bg }}>{ev.category}</span>
                      </p>
                      {ev.description && (
                        <p className="text-xs mt-1.5 line-clamp-2 leading-relaxed"
                          style={{ color: 'var(--text-secondary)' }}>
                          {ev.description}
                        </p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function CalendarClient({
  initialEvents,
  initialMonth,
  userRole,
  userProfileId,
  isAuthenticated,
}: Props) {
  const { lang, t } = useLanguage()
  const MONTHS = MONTHS_I18N[lang]

  const [view, setView]       = useState<View>('month')
  const [current, setCurrent] = useState(() => {
    const [y, m] = initialMonth.split('-').map(Number)
    return new Date(y, m - 1, 1)
  })
  const [selectedEventId, setSelectedEventId]     = useState<string | null>(null)
  const [anchorRect, setAnchorRect]               = useState<DOMRect | null>(null)
  const [showN21, setShowN21]                     = useState(true)
  const [showPersonal, setShowPersonal]           = useState(true)

  const canSeePersonal = isAuthenticated && userRole !== 'guest'
  const fetchMonth     = view === 'agenda' ? null : toMonthParam(current)

  const { data: rawEvents = [] } = useQuery<CalendarEvent[]>({
    queryKey: ['events', fetchMonth],
    queryFn: () =>
      fetch(`/api/calendar${fetchMonth ? `?month=${fetchMonth}` : ''}`).then(r => r.json()),
    initialData: fetchMonth === initialMonth ? initialEvents : undefined,
    staleTime: 60_000,
  })

  const events = useMemo(() =>
    rawEvents.filter(e => {
      if (e.category === 'N21')      return showN21
      if (e.category === 'Personal') return canSeePersonal && showPersonal
      return true
    }),
    [rawEvents, showN21, showPersonal, canSeePersonal]
  )

  const navigate = useCallback((dir: 1 | -1) => {
    setCurrent(prev => {
      const d = new Date(prev)
      if (view === 'month')  d.setMonth(d.getMonth() + dir)
      if (view === 'week')   d.setDate(d.getDate() + dir * 7)
      if (view === 'day')    d.setDate(d.getDate() + dir)
      if (view === 'agenda') d.setMonth(d.getMonth() + dir)
      return d
    })
  }, [view])

  const goToday = useCallback(() => setCurrent(new Date()), [])

  const handleEventClick = useCallback((id: string, rect: DOMRect) => {
    setSelectedEventId(id)
    setAnchorRect(rect)
  }, [])

  const handleDayClick = (date: Date) => {
    setCurrent(date)
    setView('day')
  }

  const periodLabel = useMemo(() => {
    if (view === 'month' || view === 'agenda') {
      return `${MONTHS[current.getMonth()]} ${current.getFullYear()}`
    }
    if (view === 'week') {
      const ws = startOfWeek(current)
      const we = addDays(ws, 6)
      return `W${isoWeek(ws)} · ${ws.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${we.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
    }
    if (view === 'day') {
      return current.toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    }
    return ''
  }, [view, current, MONTHS])

  const views: { key: View; label: string }[] = [
    { key: 'month',  label: t('cal.month')  },
    { key: 'week',   label: t('cal.week')   },
    { key: 'day',    label: t('cal.day')    },
    { key: 'agenda', label: t('cal.agenda') },
  ]

  return (
    <div className="flex flex-col h-full w-full" style={{ backgroundColor: "var(--bg-global)" }}>
      {/* ── Toolbar — single row on desktop, two rows on mobile ── */}
      <div className="flex-shrink-0 border-b" style={{ backgroundColor: 'var(--bg-global)', borderColor: 'var(--border-default)' }}>
        <div className="max-w-[1024px] mx-auto px-4 md:px-6 lg:px-8">

          {/* Mobile: two rows */}
          <div className="flex md:hidden items-center gap-2 py-2.5">
            <button onClick={() => navigate(-1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5"
              style={{ color: 'var(--text-primary)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <button onClick={goToday}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold border"
              style={{ borderColor: 'var(--crimson)', color: 'var(--crimson)' }}>
              {t('cal.today')}
            </button>
            <button onClick={() => navigate(1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5"
              style={{ color: 'var(--text-primary)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
            <p className="flex-1 text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {periodLabel}
            </p>
          </div>

          <div className="flex md:hidden items-center justify-between gap-2 pb-2.5">
            <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
              {views.map(v => (
                <button key={v.key} onClick={() => setView(v.key)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                  style={{
                    backgroundColor: view === v.key ? 'white' : 'transparent',
                    color: view === v.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: view === v.key ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                  }}>
                  {v.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => setShowN21(v => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all"
                style={{
                  backgroundColor: showN21 ? 'var(--forest)' : 'rgba(0,0,0,0.06)',
                  color: showN21 ? 'white' : 'var(--text-secondary)',
                }}>
                <span className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: showN21 ? 'rgba(255,255,255,0.6)' : 'var(--forest)' }} />
                N21
              </button>
              {canSeePersonal && (
                <button onClick={() => setShowPersonal(v => !v)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: showPersonal ? 'var(--sienna)' : 'rgba(0,0,0,0.06)',
                    color: showPersonal ? 'white' : 'var(--text-secondary)',
                  }}>
                  <span className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: showPersonal ? 'rgba(255,255,255,0.6)' : 'var(--sienna)' }} />
                  {t('cal.personal')}
                </button>
              )}
            </div>
          </div>

          {/* Desktop: single row */}
          <div className="hidden md:flex items-center gap-3 py-2.5">
            <div className="flex items-center gap-1">
              <button onClick={() => navigate(-1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors"
                style={{ color: 'var(--text-primary)' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
              <button onClick={goToday}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors hover:bg-black/[0.02]"
                style={{ borderColor: 'var(--crimson)', color: 'var(--crimson)' }}>
                {t('cal.today')}
              </button>
              <button onClick={() => navigate(1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors"
                style={{ color: 'var(--text-primary)' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>

            <p className="flex-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {periodLabel}
            </p>

            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <button onClick={() => setShowN21(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: showN21 ? 'var(--forest)' : 'rgba(0,0,0,0.06)',
                    color: showN21 ? 'white' : 'var(--text-secondary)',
                  }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: showN21 ? 'rgba(255,255,255,0.6)' : 'var(--forest)' }} />
                  N21
                </button>
                {canSeePersonal && (
                  <button onClick={() => setShowPersonal(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                    style={{
                      backgroundColor: showPersonal ? 'var(--sienna)' : 'rgba(0,0,0,0.06)',
                      color: showPersonal ? 'white' : 'var(--text-secondary)',
                    }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: showPersonal ? 'rgba(255,255,255,0.6)' : 'var(--sienna)' }} />
                    {t('cal.personal')}
                  </button>
                )}
              </div>

              <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
                {views.map(v => (
                  <button key={v.key} onClick={() => setView(v.key)}
                    className="px-3 py-1 rounded-md text-xs font-medium transition-all"
                    style={{
                      backgroundColor: view === v.key ? 'white' : 'transparent',
                      color: view === v.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                      boxShadow: view === v.key ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                    }}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Calendar grid ── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="max-w-[1024px] mx-auto h-full flex flex-col">
          {view === 'month' && (
            <MonthView
              current={current}
              events={events}
              onEventClick={handleEventClick}
              onDayClick={handleDayClick}
            />
          )}
          {view === 'week' && (
            <WeekView
              current={current}
              events={events}
              onEventClick={handleEventClick}
            />
          )}
          {view === 'day' && (
            <DayView
              current={current}
              events={events}
              onEventClick={handleEventClick}
            />
          )}
          {view === 'agenda' && (
            <AgendaView
              events={events}
              onEventClick={handleEventClick}
            />
          )}
        </div>
      </div>

      {/* ── Floating event popover — no backdrop ── */}
      {selectedEventId && (
        <EventPopup
          eventId={selectedEventId}
          anchorRect={anchorRect}
          onClose={() => { setSelectedEventId(null); setAnchorRect(null) }}
          userRole={userRole}
          userProfileId={userProfileId}
        />
      )}
    </div>
  )
}
