'use client'

import { useState } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { buildGoogleCalUrl, buildOutlookUrl, buildIcsContent } from '@/lib/calendar-links'

type Props = {
  eventId:    string
  eventTitle: string
  meetingUrl: string | null
  startTime:  string   // ISO string from DB
  endTime:    string   // ISO string from DB
}

// -- Component -----------------------------------------------------------------
// Calendar link builders live in lib/calendar-links.ts (2608-DEV-707) — the
// member confirmation email builds the same links server-side.

export function JoinActions({
  eventId,
  eventTitle,
  meetingUrl,
  startTime,
  endTime,
}: Props) {
  const [calOpen, setCalOpen] = useState(false)
  const { t } = useLanguage()

  // -- .ics download -----------------------------------------------------------
  function downloadIcs() {
    const content = buildIcsContent(eventTitle, startTime, endTime, meetingUrl)
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${eventTitle.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'event'}.ics`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mt-6 space-y-3">

      {/* -- Failsafe: plain-text meeting URL ---------------------------------- */}
      {meetingUrl && (
        <div
          className="rounded-xl px-4 py-3"
          style={{
            backgroundColor: 'var(--bg-global)',
            border: '1px solid var(--border-default)',
          }}
        >
          <p className="text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            {t('event.join.copyLinkHint')}
          </p>
          <a
            href={meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs break-all underline"
            style={{ color: 'var(--text-primary)' }}
          >
            {meetingUrl}
          </a>
        </div>
      )}

      {/* -- Divider ----------------------------------------------------------- */}
      <hr style={{ borderColor: 'var(--border-default)' }} />

      {/* -- Add to calendar --------------------------------------------------- */}
      {startTime && endTime && (
        <div>
          <button
            onClick={() => setCalOpen(o => !o)}
            className="w-full flex items-center justify-between text-sm font-medium py-1.5"
            style={{ color: 'var(--text-primary)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <span>{t('event.join.addToCalendar')}</span>
            <svg
              style={{ transition: 'transform 0.2s', transform: calOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {calOpen && (
            <div className="space-y-2 mt-2">
              <a
                href={buildGoogleCalUrl(eventTitle, startTime, endTime, meetingUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 w-full rounded-xl px-4 py-2.5 text-sm font-medium hover:opacity-75 transition-opacity"
                style={{
                  backgroundColor: 'var(--bg-global)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              >
                {t('event.join.googleCalendar')}
              </a>
              <a
                href={buildOutlookUrl(eventTitle, startTime, endTime, meetingUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 w-full rounded-xl px-4 py-2.5 text-sm font-medium hover:opacity-75 transition-opacity"
                style={{
                  backgroundColor: 'var(--bg-global)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              >
                {t('event.join.outlook')}
              </a>
              <button
                onClick={downloadIcs}
                className="flex items-center gap-2 w-full rounded-xl px-4 py-2.5 text-sm font-medium hover:opacity-75 transition-opacity text-left"
                style={{
                  backgroundColor: 'var(--bg-global)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                {t('event.join.downloadIcs')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
