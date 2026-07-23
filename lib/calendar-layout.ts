// ── lib/calendar-layout.ts ───────────────────────────────────────────────
// Pure segment/lane layout for Month-view spanning event bars. No DOM, no
// React — kept separate so the packing algorithm is unit-testable directly.
import { sofiaDateKeysBetween } from '@/lib/calendar-dates'

export const MAX_LANES = 3

export type LayoutEvent = {
  id: string
  start_time: string
  end_time: string
}

export type Segment<T extends LayoutEvent> = {
  event: T
  startCol: number // 0-6, index into the week's 7 day keys
  span: number // 1-7
  lane: number
  continuesLeft: boolean
  continuesRight: boolean
}

/**
 * Packs events into segments + lanes for a single week (7 Sofia date keys,
 * Monday-first). Events outside the week are ignored; events overlapping the
 * week are clipped to it, with continuesLeft/Right marking the clip.
 *
 * Deterministic ordering (startCol asc, span desc, start_time asc, id asc) so
 * server and client render identical markup — no Date.now(), no locale
 * comparison. Lanes beyond MAX_LANES are dropped; per-day overflow counts are
 * derived by the caller from the dropped segments.
 */
export function packWeek<T extends LayoutEvent>(
  weekDateKeys: string[],
  events: T[]
): { segments: Segment<T>[]; overflowByCol: number[] } {
  const weekStart = weekDateKeys[0]
  const weekEnd = weekDateKeys[weekDateKeys.length - 1]

  const candidates = events
    .map(event => {
      const keys = sofiaDateKeysBetween(event.start_time, event.end_time)
      const eventStart = keys[0]
      const eventEnd = keys[keys.length - 1]
      if (eventEnd < weekStart || eventStart > weekEnd) return null

      // Date keys are 'YYYY-MM-DD' strings, lexically sortable — clip via
      // plain string min/max, then look up the clipped keys' positions in
      // this week's 7 consecutive day keys.
      const clippedStart = eventStart < weekStart ? weekStart : eventStart
      const clippedEnd = eventEnd > weekEnd ? weekEnd : eventEnd
      const startCol = weekDateKeys.indexOf(clippedStart)
      const endCol = weekDateKeys.indexOf(clippedEnd)

      return {
        event,
        startCol,
        span: endCol - startCol + 1,
        continuesLeft: eventStart < weekStart,
        continuesRight: eventEnd > weekEnd,
      }
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) =>
      a.startCol - b.startCol ||
      b.span - a.span ||
      a.event.start_time.localeCompare(b.event.start_time) ||
      a.event.id.localeCompare(b.event.id)
    )

  const laneEnds: number[] = [] // laneEnds[lane] = last occupied column
  const segments: Segment<T>[] = []
  const overflowByCol = Array.from({ length: 7 }, () => 0)

  for (const c of candidates) {
    let lane = laneEnds.findIndex(end => end < c.startCol)
    if (lane === -1) lane = laneEnds.length
    if (lane >= MAX_LANES) {
      for (let col = c.startCol; col < c.startCol + c.span; col++) overflowByCol[col]++
      continue
    }
    laneEnds[lane] = c.startCol + c.span - 1
    segments.push({ ...c, lane })
  }

  return { segments, overflowByCol }
}
