'use client'

import { useState } from 'react'
import { CalendarPlus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { buildGoogleCalUrl, buildOutlookUrl, buildIcsContent } from '@/lib/calendar-links'

/**
 * Add-to-calendar dropdown over lib/calendar-links.ts (2608-DEV-707).
 *
 * Lives in /components rather than co-located because two unrelated routes
 * consume it — the calendar popup and the public register page (T6) — which
 * satisfies the promotion rule in CLAUDE.md.
 *
 * The .ics is a client-only Blob download (no server round-trip), which is
 * also why the confirmation email links to the join page for it instead of
 * attaching a file.
 */

type Props = {
  title: string
  startTime: string
  endTime: string
  meetingUrl: string | null
  /** Layer above the Radix Dialog (z-50) this menu is usually opened inside. */
  contentClassName?: string
}

const itemClass = 'flex items-center gap-2 w-full px-4 py-2.5 text-sm font-medium cursor-pointer transition-colors'
const itemStyle = { color: 'var(--text-primary)' } as const

function hoverIn(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.backgroundColor = 'var(--bg-global)'
}
function hoverOut(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.backgroundColor = 'transparent'
}

export default function AddToCalendarMenu({
  title,
  startTime,
  endTime,
  meetingUrl,
  contentClassName = 'z-[60]',
}: Props) {
  const [open, setOpen] = useState(false)
  const { t } = useLanguage()

  function downloadIcs() {
    const content = buildIcsContent(title, startTime, endTime, meetingUrl)
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // A title of only punctuation slugs to '' — an empty basename, not a falsy
    // value to be ||'d away.
    const slug = title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    a.download = `${slug === '' ? 'event' : slug}.ics`
    // Appended before clicking, and revoked on the next tick: a detached anchor
    // plus a synchronous revoke drops the blob before the download starts in
    // Firefox/Safari, producing no file at all. Matches downloadQr's
    // append/click/remove in EventPopup.tsx.
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-1.5 text-xs font-medium hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <CalendarPlus size={12} />
          {t('event.join.addToCalendar')}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className={contentClassName}>
        <DropdownMenuItem asChild>
          <a
            href={buildGoogleCalUrl(title, startTime, endTime, meetingUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className={itemClass}
            style={itemStyle}
            onMouseEnter={hoverIn}
            onMouseLeave={hoverOut}
          >
            {t('event.join.googleCalendar')}
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <a
            href={buildOutlookUrl(title, startTime, endTime, meetingUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className={itemClass}
            style={itemStyle}
            onMouseEnter={hoverIn}
            onMouseLeave={hoverOut}
          >
            {t('event.join.outlook')}
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <button
            onClick={downloadIcs}
            className={`${itemClass} text-left`}
            style={{ ...itemStyle, background: 'none', border: 'none' }}
            onMouseEnter={hoverIn}
            onMouseLeave={hoverOut}
          >
            {t('event.join.downloadIcs')}
          </button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
