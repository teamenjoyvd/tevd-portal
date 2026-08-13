'use client'

import { ReactNode } from 'react'
import { formatTime, formatLongDate, TZ } from '@/lib/format'
import { sofiaDateKeysBetween } from '@/lib/calendar-dates'
import { X, QrCode, Download } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog'
import type { TranslationKey } from '@/lib/i18n'
import type { EventDetail } from './types'
import AttendSection from './AttendSection'

const RANGE_DAY_MONTH_FMT = new Intl.DateTimeFormat('bg-BG', { day: '2-digit', month: '2-digit', timeZone: TZ })
const RANGE_FULL_FMT = new Intl.DateTimeFormat('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ })

/**
 * '23.10 – 25.10.2026' for a multi-day all-day event within one year,
 * '30.12.2026 – 02.01.2027' when the span crosses a year boundary (the
 * short day/month start format would otherwise leave the start year
 * ambiguous), or a single full date for a same-day event.
 */
function formatAllDayRange(startIso: string, endIso: string): string {
  const keys = sofiaDateKeysBetween(startIso, endIso)
  if (keys.length === 1) return formatLongDate(startIso)
  const start = new Date(`${keys[0]}T12:00:00Z`)
  const end = new Date(`${keys[keys.length - 1]}T12:00:00Z`)
  const sameYear = keys[0].slice(0, 4) === keys[keys.length - 1].slice(0, 4)
  const startFmt = sameYear ? RANGE_DAY_MONTH_FMT : RANGE_FULL_FMT
  return `${startFmt.format(start)} – ${RANGE_FULL_FMT.format(end)}`
}

// Theme-aware token pairs, not literals — the popup is rendered in dark mode
// too. See app/(dashboard)/calendar/components/popup/styles.ts.
const EVENT_TYPE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  'in-person': { bg: 'var(--status-success-bg)', color: 'var(--status-success-fg)', label: 'In-Person' },
  'online':    { bg: 'var(--status-info-bg)',    color: 'var(--status-info-fg)',    label: 'Online'    },
  'hybrid':    { bg: 'var(--status-pending-bg)', color: 'var(--status-pending-fg)', label: 'Hybrid'    },
}

type Props = {
  event: EventDetail | undefined
  isLoading: boolean
  onClose: () => void
  isGuest: boolean
  showMeta: boolean
  shareLoading: boolean
  shareCopied: boolean
  qrLoading: boolean
  qrDataUrl: string | null
  onQrDismiss: () => void
  onShare: () => void
  onQrShare: () => void
  downloadQr: () => void
  isAdmin: boolean
  isEventEnded: boolean
  attendPending: boolean
  onAttend: () => void
  onCancelAttend: () => void
  t: (key: TranslationKey) => string
  children: ReactNode
}

export default function EventPopupShell({
  event, isLoading, onClose, isGuest, showMeta,
  shareLoading, shareCopied, qrLoading, qrDataUrl, onQrDismiss, onShare, onQrShare, downloadQr,
  isAdmin, isEventEnded, attendPending, onAttend, onCancelAttend,
  t, children,
}: Props) {
  const eventTypeStyle = event?.event_type ? EVENT_TYPE_STYLES[event.event_type] : null

  // The action row (Attend for non-admins, plus Share/QR) is deliberately NOT
  // tab-scoped — see the comment on the body block below. 2608-DEV-726.
  const showActions =
    event !== undefined && event.allow_guest_registration === true && isGuest === false

  return (
    <>
      {/* Header */}
      <div className="px-4 pt-3 pb-3 border-b border-black/5 flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-xl"
                style={{ backgroundColor: event?.category === 'N21' ? 'var(--brand-forest)' : 'var(--brand-sienna)', color: 'rgba(255,255,255,0.9)' }}>
                {event?.category ?? '…'}
              </span>
              {eventTypeStyle && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-xl"
                  style={{ backgroundColor: eventTypeStyle.bg, color: eventTypeStyle.color }}>
                  {eventTypeStyle.label}
                </span>
              )}
              {event && (
                <span className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>W{event.week_number}</span>
              )}
            </div>
            {/* A real DialogTitle, not a <p>: this Dialog previously had none,
                which Radix warns about and which left the modal without an
                accessible name. Promoting the title fixes the a11y gap and the
                size in one place. DialogTitle's own `text-base` is overridden
                by `text-lg` — Tailwind emits the larger step later. */}
            <DialogTitle className="font-display text-lg font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
              {isLoading ? '…' : event?.title}
            </DialogTitle>
          </div>
          <button onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[var(--bg-card-raised)] transition-colors flex-shrink-0 mt-0.5"
            style={{ color: 'var(--text-secondary)' }}>
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {children}

        {/* Meta */}
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-6 rounded animate-pulse" style={{ backgroundColor: 'var(--skeleton-base)' }} />
            ))}
          </div>
        ) : event ? (
          <>
            {/* `showMeta` gates the META only (2608-DEV-726). The action row is
                deliberately outside that gate: a member who opens the
                Registrations tab to see who is coming must keep the Attend,
                Share and QR controls, which #721 made reachable-then-hidden by
                giving members the tab bar. Both halves stay inside ONE bordered
                container so the Roles tab renders exactly as before — a sibling
                block would add a second divider to a screen that has no bug. */}
            {(showMeta || showActions) && (
              <div className="px-4 py-3 border-b border-black/5">
                {showMeta && (
                  <>
                    <div className="flex items-center gap-2 text-xs mb-1" style={{ color: 'var(--text-primary)' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                        stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="18" height="18" x="3" y="4" rx="2"/>
                        <line x1="16" x2="16" y1="2" y2="6"/>
                        <line x1="8" x2="8" y1="2" y2="6"/>
                        <line x1="3" x2="21" y1="10" y2="10"/>
                      </svg>
                      <span className="font-medium">
                        {event.is_all_day ? formatAllDayRange(event.start_time, event.end_time) : formatLongDate(event.start_time)}
                      </span>
                    </div>
                    {!event.is_all_day && (
                      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                          stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <polyline points="12 6 12 12 16 14"/>
                        </svg>
                        <span>{formatTime(event.start_time)} – {formatTime(event.end_time)}</span>
                      </div>
                    )}
                    {!isGuest && event.meeting_url && (
                      <div className="flex items-center gap-2 text-xs mt-1">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                          stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                        </svg>
                        <a href={event.meeting_url} target="_blank" rel="noopener noreferrer"
                          className="truncate hover:underline" style={{ color: 'var(--brand-teal)' }}>
                          {event.meeting_url}
                        </a>
                      </div>
                    )}
                    {/* Gated (D3): the API already nulled meeting_url for a non-attending
                        non-admin caller on an event open for guest sharing — this hint
                        is the only surface that explains why the link is missing. Also
                        requires no active registration: an already-attending member on
                        an event with no meeting_url configured at all must not be told
                        to attend for a link that will never appear. Stays tab-scoped
                        with the meta: it explains an absent meeting_url, which is meta. */}
                    {!isGuest && !isAdmin && !event.meeting_url && event.allow_guest_registration && event.caller_registration === null && (
                      <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {t('cal.attendForLink')}
                      </p>
                    )}
                  </>
                )}
                {showActions && (
                  <div className={showMeta ? 'mt-3 space-y-3' : 'space-y-3'}>
                    {!isAdmin && (
                      <AttendSection
                        isRegistered={event.caller_registration !== null}
                        isEnded={isEventEnded}
                        isPending={attendPending}
                        onAttend={onAttend}
                        onCancelAttend={onCancelAttend}
                        t={t}
                        eventId={event.id}
                        title={event.title}
                        startTime={event.start_time}
                        endTime={event.end_time}
                        meetingUrl={event.meeting_url}
                      />
                    )}
                    <div className="flex items-center gap-4">
                      <button
                        onClick={onShare}
                        disabled={shareLoading}
                        className="flex items-center gap-1.5 text-xs font-medium hover:opacity-70 transition-opacity disabled:opacity-40"
                        style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="18" cy="5" r="3"/>
                          <circle cx="6" cy="12" r="3"/>
                          <circle cx="18" cy="19" r="3"/>
                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                        </svg>
                        {shareLoading ? '…' : shareCopied ? t('cal.linkCopied') : t('cal.shareEvent')}
                      </button>
                      <button
                        onClick={onQrShare}
                        disabled={qrLoading}
                        className="flex items-center gap-1.5 text-xs font-medium hover:opacity-70 transition-opacity disabled:opacity-40"
                        style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        <QrCode size={12} />
                        {qrLoading ? '…' : t('cal.qrShare')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {showMeta && event.description && event.description !== event.meeting_url && (
              <div className="px-4 py-3">
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{event.description}</p>
              </div>
            )}
          </>
        ) : null}

        {/* Scroll-fade */}
        <div aria-hidden style={{
          position: 'sticky', bottom: 0, left: 0, right: 0, height: 32,
          background: 'linear-gradient(to bottom, transparent, var(--bg-global))',
          pointerEvents: 'none',
        }} />
      </div>

      <Dialog open={qrDataUrl !== null} onOpenChange={(open) => { if (!open) onQrDismiss() }}>
        <DialogPortal>
          <DialogOverlay className="z-[60]" style={{ backgroundColor: 'rgba(0,0,0,0.32)' }} />
          <DialogContent
            className="left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 p-5 z-[60]"
            style={{ width: 320, maxWidth: '90vw', border: '1px solid var(--border-default)' }}
          >
            <DialogHeader className="mb-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <DialogTitle className="font-display" style={{ color: 'var(--text-primary)' }}>
                    {t('cal.qrTitle')}
                  </DialogTitle>
                  <DialogDescription>{t('cal.qrDescription')}</DialogDescription>
                </div>
                <button
                  onClick={onQrDismiss}
                  aria-label="Close"
                  className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[var(--bg-card-raised)] transition-colors flex-shrink-0 mt-0.5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <X size={14} />
                </button>
              </div>
            </DialogHeader>
            {qrDataUrl !== null && (
              <div className="flex flex-col items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt={t('cal.qrTitle')}
                  width={256}
                  height={256}
                  className="h-auto w-full max-w-[256px] rounded-lg border"
                  style={{ borderColor: 'var(--border-default)' }}
                />
                <button
                  onClick={downloadQr}
                  className="flex items-center gap-1.5 rounded-xl px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: 'var(--brand-teal)' }}
                >
                  <Download size={14} />
                  {t('cal.qrDownload')}
                </button>
              </div>
            )}
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </>
  )
}
