'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { DAYS_I18N, MONTHS_I18N } from '@/lib/i18n/translations'
import EventPopup from '@/app/(dashboard)/calendar/components/EventPopup'

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

type View = 'month' | 'agenda'

type Props = {
  initialEvents: CalendarEvent[]
  initialMonth: string
  initialEventId: string | null
  userRole: 'admin' | 'core' | 'member' | 'guest' | null
  userProfileId: string | null
  isAuthenticated: boolean
}

// ── Constants ────────────────────────────────────────────────────────

const HOURS  = Array.from({ length: 24 }, (_, i) => i)
const HOUR_HEIGHT = 60

const CATEGORY_COLOR: Record<string, { bg: string; text: string }> = {
  N21:      { bg: 'var(--forest)',  text: 'rgba(255,255,255,0.95)' },
  Personal: { bg: 'var(--sienna)', text: 'rgba(255,255,255,0.95)' },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Event pill ────────────────────────────────────────────────────────────────────────

function EventPill({
  event, onClick, compact = false,
}: {
  event: CalendarEvent
  onClick: (el: HTMLElement) => void
  compact?: boolean
}) {
  const c = CATEGORY_COLOR[event.category]
  return (
    <button
      onClick={e => {
        e.stopPropagation()
        onClick(e.currentTarget)
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

// ── Month View ────────────────────────────────────────────────────────────────────────

function MonthView({
  current, events, onEventClick, onDayClick,
}: {
  current: Date
  events: CalendarEvent[]
  onEventClick: (id: string, el: HTMLElement) => void
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
                          onClick={(el) => onEventClick(ev.id, el)}
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

// ── Agenda View ────────────────────────────────────────────────────────────────────────────

function AgendaView({
  events, onEventClick, isLoading, highlightId,
}: {
  events: CalendarEvent[]
  onEventClick: (id: string, el: HTMLElement) => void
  isLoading: boolean
  highlightId?: string | null
}) {
  const { t } = useLanguage()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const highlightRef = useRef<HTMLButtonElement | null>(null)

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

  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [grouped])

  const dates = Object.keys(grouped)

  if (isLoading) {
    return (
      <div className="overflow-y-auto px-4 py-4 space-y-4" style={{ height: 'var(--cal-height)', minHeight: 300 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-6 w-32 rounded-full animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.06)' }} />
            <div className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.04)' }} />
          </div>
        ))}
      </div>
    )
  }

  if (dates.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('cal.noEvents')}</p>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto px-4 py-2" style={{ height: 'var(--cal-height)', minHeight: 300 }}>
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
                const isHighlighted = ev.id === highlightId
                return (
                  <button
                    key={ev.id}
                    ref={isHighlighted ? highlightRef : null}
                    onClick={e => onEventClick(ev.id, e.currentTarget)}
                    className="w-full text-left rounded-xl border overflow-hidden hover:shadow-sm transition-shadow flex"
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      borderColor: isHighlighted ? 'var(--brand-crimson)' : 'rgba(0,0,0,0.05)',
                      boxShadow: isHighlighted ? '0 0 0 2px rgba(188,71,73,0.25)' : undefined,
                    }}
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

// ── Main ─────────────────────────────────────────────────────────────────────────────

export default function CalendarClient({
  initialEvents,
  initialMonth,
  initialEventId,
  userRole,
  userProfileId,
  isAuthenticated,
}: Props) {
  const { lang, t } = useLanguage()
  const MONTHS = MONTHS_I18N[lang]

  const [view, setView]       = useState<View>(initialEventId ? 'agenda' : 'month')
  const [current, setCurrent] = useState(() => {
    const [y, m] = initialMonth.split('-').map(Number)
    return new Date(y, m - 1, 1)
  })
  const [selectedEventId, setSelectedEventId]     = useState<string | null>(initialEventId)
  const [anchorEl, setAnchorEl]                   = useState<HTMLElement | null>(null)
  const [showN21, setShowN21]                     = useState(true)
  const [showPersonal, setShowPersonal]           = useState(true)
  const [filterType, setFilterType]               = useState<'in-person' | 'online' | 'hybrid' | null>(null)
  const [deepLinkId, setDeepLinkId]               = useState<string | null>(initialEventId)

  const canSeePersonal = isAuthenticated && userRole !== 'guest'

  const { data: monthEvents = [] } = useQuery<CalendarEvent[]>({
    queryKey: ['events-month', toMonthParam(current)],
    queryFn: () =>
      fetch(`/api/calendar?month=${toMonthParam(current)}`).then(r => r.json()),
    initialData: toMonthParam(current) === initialMonth ? initialEvents : undefined,
    staleTime: 60_000,
    enabled: view === 'month',
  })

  const { data: agendaEvents = [], isPending: agendaPending } = useQuery<CalendarEvent[]>({
    queryKey: ['events-agenda'],
    queryFn: () => fetch('/api/calendar').then(r => r.json()),
    staleTime: 0,
    enabled: view === 'agenda',
  })

  const rawEvents = view === 'agenda' ? agendaEvents : monthEvents

  const events = useMemo(() =>
    rawEvents.filter(e => {
      if (e.category === 'N21')      return showN21
      if (e.category === 'Personal') return canSeePersonal && showPersonal
      return true
    }).filter(e =>
      filterType === null || e.event_type === filterType
    ),
    [rawEvents, showN21, showPersonal, canSeePersonal, filterType]
  )

  const navigate = useCallback((dir: 1 | -1) => {
    setCurrent(prev => {
      const d = new Date(prev)
      d.setMonth(d.getMonth() + dir)
      return d
    })
  }, [])

  const goToday = useCallback(() => setCurrent(new Date()), [])

  const handleEventClick = useCallback((id: string, el: HTMLElement) => {
    setSelectedEventId(id)
    setAnchorEl(el)
  }, [])

  const handleDayClick = (date: Date) => {
    setCurrent(date)
  }

  const periodLabel = useMemo(() => {
    return `${MONTHS[current.getMonth()]} ${current.getFullYear()}`
  }, [view, current, MONTHS])

  const views: { key: View; label: string }[] = [
    { key: 'agenda', label: t('cal.agenda') },
    { key: 'month',  label: t('cal.month')  },
  ]

  const TYPE_FILTERS = (['in-person', 'online', 'hybrid'] as const)

  return (
    <div className="w-full" style={{ backgroundColor: 'var(--bg-global)' }}>

      {/* Mobile: top-toolbar layout */}
      <div className="md:hidden">
        <div className="flex-shrink-0 border-b" style={{ backgroundColor: 'var(--bg-global)', borderColor: 'var(--border-default)' }}>
          <div className="max-w-[1024px] mx-auto px-4">
            {/* Row 1: period nav */}
            <div className="flex items-center gap-2 py-2.5">
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
            {/* Row 2: view switcher */}
            <div className="flex items-center justify-between gap-2 pb-2">
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
            </div>
            {/* Row 3: category + format filter chips */}
            <div className="flex items-center gap-1.5 pb-2.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              <button
                onClick={() => setShowN21(v => !v)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 transition-all"
                style={{
                  backgroundColor: showN21 ? 'var(--forest)' : 'rgba(0,0,0,0.05)',
                  color: showN21 ? 'white' : 'var(--text-secondary)',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: showN21 ? 'rgba(255,255,255,0.6)' : 'var(--forest)' }} />
                N21
              </button>
              {canSeePersonal && (
                <button
                  onClick={() => setShowPersonal(v => !v)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 transition-all"
                  style={{
                    backgroundColor: showPersonal ? 'var(--sienna)' : 'rgba(0,0,0,0.05)',
                    color: showPersonal ? 'white' : 'var(--text-secondary)',
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: showPersonal ? 'rgba(255,255,255,0.6)' : 'var(--sienna)' }} />
                  {t('cal.personal')}
                </button>
              )}
              <div className="w-px h-4 flex-shrink-0" style={{ backgroundColor: 'var(--border-default)' }} />
              {TYPE_FILTERS.map(type => (
                <button
                  key={type}
                  onClick={() => setFilterType(filterType === type ? null : type)}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 transition-all"
                  style={{
                    backgroundColor: filterType === type ? 'var(--brand-teal)' : 'rgba(0,0,0,0.05)',
                    color: filterType === type ? 'white' : 'var(--text-secondary)',
                  }}
                >
                  {type === 'in-person' ? t('cal.inPerson') : type === 'online' ? t('cal.online') : t('cal.hybrid')}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="max-w-[1024px] mx-auto">
          {view === 'month' && (
            <MonthView current={current} events={events} onEventClick={handleEventClick} onDayClick={handleDayClick} />
          )}
          {view === 'agenda' && (
            <AgendaView events={events} onEventClick={handleEventClick} isLoading={agendaPending} highlightId={deepLinkId} />
          )}
        </div>
      </div>

      {/* Desktop: col-2 nav sidebar + col-10 calendar */}
      <div className="hidden md:block py-8 pb-16">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 xl:px-12">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
              gap: '12px',
              alignItems: 'start',
            }}
          >
            {/* col-2: left nav sidebar */}
            <div
              style={{ gridColumn: 'span 2', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
              className="rounded-2xl p-4 flex flex-col gap-4 sticky top-24"
            >
              {/* Period nav */}
              <div>
                <p className="font-display text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  {periodLabel}
                </p>
                <div className="flex gap-1 mt-2">
                  <button onClick={() => navigate(-1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors flex-shrink-0"
                    style={{ color: 'var(--text-primary)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6"/>
                    </svg>
                  </button>
                  <button onClick={() => navigate(1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors flex-shrink-0"
                    style={{ color: 'var(--text-primary)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>
                </div>
                <button onClick={goToday}
                  className="mt-2 w-full px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors hover:bg-black/[0.02]"
                  style={{ borderColor: 'var(--crimson)', color: 'var(--crimson)' }}>
                  {t('cal.today')}
                </button>
              </div>

              {/* View switcher */}
              <div>
                <p className="text-[10px] font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>View</p>
                <div className="flex flex-col gap-0.5">
                  {views.map(v => (
                    <button key={v.key} onClick={() => setView(v.key)}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all"
                      style={{
                        backgroundColor: view === v.key ? 'rgba(188,71,73,0.08)' : 'transparent',
                        color: view === v.key ? 'var(--brand-crimson)' : 'var(--text-secondary)',
                        fontWeight: view === v.key ? 600 : 400,
                      }}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category filters */}
              <div>
                <p className="text-[10px] font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>Category</p>
                <div className="flex flex-col gap-1.5">
                  <button onClick={() => setShowN21(v => !v)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      backgroundColor: showN21 ? 'var(--forest)' : 'rgba(0,0,0,0.04)',
                      color: showN21 ? 'white' : 'var(--text-secondary)',
                    }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: showN21 ? 'rgba(255,255,255,0.6)' : 'var(--forest)' }} />
                    N21
                  </button>
                  {canSeePersonal && (
                    <button onClick={() => setShowPersonal(v => !v)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        backgroundColor: showPersonal ? 'var(--sienna)' : 'rgba(0,0,0,0.04)',
                        color: showPersonal ? 'white' : 'var(--text-secondary)',
                      }}>
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: showPersonal ? 'rgba(255,255,255,0.6)' : 'var(--sienna)' }} />
                      {t('cal.personal')}
                    </button>
                  )}
                </div>
              </div>

              {/* Event type filters */}
              <div>
                <p className="text-[10px] font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>Format</p>
                <div className="flex flex-col gap-1">
                  {TYPE_FILTERS.map(type => (
                    <button key={type} onClick={() => setFilterType(filterType === type ? null : type)}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        backgroundColor: filterType === type ? 'var(--brand-teal)' : 'rgba(0,0,0,0.04)',
                        color: filterType === type ? 'white' : 'var(--text-secondary)',
                      }}>
                      {type === 'in-person' ? t('cal.inPerson') : type === 'online' ? t('cal.online') : t('cal.hybrid')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* col-10: calendar */}
            <div
              style={{ gridColumn: 'span 10', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-global)' }}
              className="rounded-2xl overflow-hidden"
            >
              {view === 'month' && (
                <MonthView
                  current={current}
                  events={events}
                  onEventClick={handleEventClick}
                  onDayClick={handleDayClick}
                />
              )}
              {view === 'agenda' && (
                <AgendaView
                  events={events}
                  onEventClick={handleEventClick}
                  isLoading={agendaPending}
                  highlightId={deepLinkId}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating event popover */}
      {selectedEventId && (
        <EventPopup
          eventId={selectedEventId}
          anchorEl={anchorEl}
          onClose={() => { setSelectedEventId(null); setAnchorEl(null); setDeepLinkId(null) }}
          userRole={userRole}
          userProfileId={userProfileId}
        />
      )}
    </div>
  )
}
