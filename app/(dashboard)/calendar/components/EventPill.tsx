import { type CalendarEvent } from '@/app/(dashboard)/calendar/types'
import { CATEGORY_COLOR, formatTime } from '@/app/(dashboard)/calendar/utils'

export function EventPill({
  event,
  onClick,
  compact = false,
  continuesLeft = false,
  continuesRight = false,
}: {
  event: CalendarEvent
  onClick: () => void
  compact?: boolean
  continuesLeft?: boolean
  continuesRight?: boolean
}) {
  const c = CATEGORY_COLOR[event.category]
  return (
    <button
      onClick={e => {
        e.stopPropagation()
        onClick()
      }}
      // compact pills are the Month-view spanning bars, rendered inside an
      // aria-hidden wrapper — a <button> is tabbable regardless of an
      // ancestor's tabIndex, so it must be excluded from the tab order here too.
      tabIndex={compact ? -1 : 0}
      className="w-full text-left px-1.5 transition-opacity hover:opacity-80 active:opacity-60"
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
        borderTopLeftRadius: continuesLeft ? 0 : 6,
        borderBottomLeftRadius: continuesLeft ? 0 : 6,
        borderTopRightRadius: continuesRight ? 0 : 6,
        borderBottomRightRadius: continuesRight ? 0 : 6,
      }}
    >
      {compact ? event.title : `${formatTime(event.start_time)} ${event.title}`}
    </button>
  )
}
