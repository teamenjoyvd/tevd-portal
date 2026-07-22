'use client'

import { ReactNode } from 'react'
import { formatTime, formatLongDate } from '@/lib/format'
import { X, QrCode, Download } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { TranslationKey } from '@/lib/i18n'
import type { EventDetail } from './types'

const EVENT_TYPE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  'in-person': { bg: 'rgba(129,178,154,0.18)', color: '#2d6a4f',  label: 'In-Person' },
  'online':    { bg: 'rgba(61,64,91,0.10)',    color: '#3d405b',  label: 'Online'    },
  'hybrid':    { bg: 'rgba(242,204,143,0.35)', color: '#7a5c00',  label: 'Hybrid'    },
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
  t: (key: TranslationKey) => string
  children: ReactNode
}

export default function EventPopupShell({
  event, isLoading, onClose, isGuest, showMeta,
  shareLoading, shareCopied, qrLoading, qrDataUrl, onQrDismiss, onShare, onQrShare, downloadQr,
  t, children,
}: Props) {
  const eventTypeStyle = event?.event_type ? EVENT_TYPE_STYLES[event.event_type] : null

  return (
    <>
      {/* Header */}
      <div className="px-4 pt-3 pb-3 border-b border-black/5 flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: event?.category === 'N21' ? 'var(--brand-forest)' : 'var(--brand-sienna)', color: 'rgba(255,255,255,0.9)' }}>
                {event?.category ?? '…'}
              </span>
              {eventTypeStyle && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: eventTypeStyle.bg, color: eventTypeStyle.color }}>
                  {eventTypeStyle.label}
                </span>
              )}
              {event && (
                <span className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>W{event.week_number}</span>
              )}
            </div>
            <p className="font-display text-base font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
              {isLoading ? '…' : event?.title}
            </p>
          </div>
          <button onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors flex-shrink-0 mt-0.5"
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
              <div key={i} className="h-6 rounded animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.06)' }} />
            ))}
          </div>
        ) : event && showMeta ? (
          <>
            <div className="px-4 py-3 border-b border-black/5">
              <div className="flex items-center gap-2 text-xs mb-1" style={{ color: 'var(--text-primary)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="4" rx="2"/>
                  <line x1="16" x2="16" y1="2" y2="6"/>
                  <line x1="8" x2="8" y1="2" y2="6"/>
                  <line x1="3" x2="21" y1="10" y2="10"/>
                </svg>
                <span className="font-medium">{formatLongDate(event.start_time)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <span>{formatTime(event.start_time)} – {formatTime(event.end_time)}</span>
              </div>
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
              {event.allow_guest_registration && !isGuest && (
                <div className="mt-3 flex items-center gap-4">
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
              )}
            </div>
            {event.description && event.description !== event.meeting_url && (
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
        <DialogContent
          className="left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: 320, maxWidth: '90vw' }}
        >
          <DialogHeader>
            <DialogTitle>{t('cal.qrTitle')}</DialogTitle>
            <DialogDescription>{t('cal.qrDescription')}</DialogDescription>
          </DialogHeader>
          {qrDataUrl && (
            <div className="flex flex-col items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt={t('cal.qrTitle')}
                width={256}
                height={256}
                className="h-auto w-full max-w-[256px] rounded-lg border border-black/5"
              />
              <button
                onClick={downloadQr}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-80"
                style={{ background: 'var(--brand-teal)' }}
              >
                <Download size={14} />
                {t('cal.qrDownload')}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
