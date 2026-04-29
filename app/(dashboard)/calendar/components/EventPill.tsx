import { type CalendarEvent } from '@/app/(dashboard)/calendar/types'
import { CATEGORY_COLOR, formatTime } from '@/app/(dashboard)/calendar/utils'

export function EventPill({
  event,
  onClick,
  compact = false,
}: {
  event: CalendarEvent
  onClick: () => void
  compact?: boolean
}) {
  const c = CATEGORY_COLOR[event.category]
  return (
    <button
      onClick={e => {
        e.stopPropagation()
        onClick()
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
