'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

type CalendarEvent = {
  id: string; title: string; description: string | null
  start_time: string; end_time: string
  category: 'N21' | 'Personal'; week_number: number
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
function monthLabel(date: Date) {
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}
function toMonthParam(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export default function CalendarPage() {
  const [current, setCurrent] = useState(new Date())

  const { data: events = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ['events', toMonthParam(current)],
    queryFn: () =>
      fetch(`/api/calendar?month=${toMonthParam(current)}`).then(r => r.json()),
  })

  function prev() {
    setCurrent(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  }
  function next() {
    setCurrent(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  }

  // Group events by date string
  const grouped = events.reduce<Record<string, CalendarEvent[]>>((acc, e) => {
    const key = new Date(e.start_time).toDateString()
    if (!acc[key]) acc[key] = []
    acc[key].push(e)
    return acc
  }, {})

  const sortedDates = Object.keys(grouped).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  )

  return (
    <div className="p-4 max-w-2xl mx-auto">

      {/* Month nav */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={prev}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-stone/20 text-deep hover:border-crimson/40 transition-colors">
          ‹
        </button>
        <h1 className="font-serif text-xl text-deep">{monthLabel(current)}</h1>
        <button onClick={next}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-stone/20 text-deep hover:border-crimson/40 transition-colors">
          ›
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-white rounded-xl animate-pulse" />
          ))}
        </div>
      ) : sortedDates.length === 0 ? (
        <div className="text-center py-16 text-stone">
          <p className="font-medium">No events this month</p>
          <p className="text-sm mt-1">Check back soon or browse another month.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map(dateKey => (
            <div key={dateKey}>
              {/* Date header with week number */}
              <div className="flex items-center gap-3 mb-2">
                <p className="text-sm font-semibold text-deep">
                  {formatDate(grouped[dateKey][0].start_time)}
                </p>
                <span className="text-xs text-stone bg-white border border-stone/20 rounded-full px-2 py-0.5">
                  W{grouped[dateKey][0].week_number}
                </span>
              </div>

              <div className="space-y-2">
                {grouped[dateKey].map(event => (
                  <div key={event.id}
                    className="bg-white rounded-xl p-4 border border-stone/20 hover:border-crimson/30 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-deep text-sm">{event.title}</p>
                        {event.description && (
                          <p className="text-xs text-stone mt-1 line-clamp-2">{event.description}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-medium text-crimson">
                          {formatTime(event.start_time)}
                        </p>
                        <p className="text-xs text-stone mt-0.5">
                          {formatTime(event.end_time)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        event.category === 'N21'
                          ? 'bg-deep/10 text-deep'
                          : 'bg-sienna/10 text-sienna'
                      }`}>
                        {event.category}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}