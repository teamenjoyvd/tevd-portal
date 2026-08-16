'use client'

import { useEffect, useState } from 'react'

/**
 * 2608-DEV-749 — re-renders the caller roughly twice a minute so a
 * minutes-granularity countdown stays honest without a per-second timer.
 *
 * `enabled` is the whole point: the calendar popup only mounts this inside the
 * final hour before an event's role cutoff, so the interval does not run for
 * every open popup on the calendar. Passing `false` clears any live interval —
 * the effect re-runs on the flag, and its cleanup tears the old one down.
 *
 * Returns a monotonically increasing tick count. Callers normally ignore the
 * value and just read `Date.now()` during render; the return exists so the
 * hook's result can be used as a dependency when that is more convenient.
 */
export function useMinuteTick(enabled = true, intervalMs = 30_000): number {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => setTick(t => t + 1), intervalMs)
    return () => clearInterval(id)
  }, [enabled, intervalMs])

  return tick
}
