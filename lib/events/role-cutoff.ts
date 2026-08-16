/**
 * 2608-DEV-749 — the single definition of the event-role sign-up window.
 *
 * Before this module the window was a bare `15 * 60 * 1000` literal duplicated
 * in the route (`app/api/events/[id]/request-role/route.ts`) and in the popup
 * (`app/(dashboard)/calendar/components/EventPopup.tsx`), so the server gate and
 * the UI could drift apart silently. Both import from here now.
 *
 * Isomorphic on purpose — no `server-only`, no React, no env access — because
 * the route handler and the client component both need it.
 *
 * The window is 60 minutes (was 15). Admins bypass it; that decision belongs to
 * the caller, not here, so nothing in this file knows about roles.
 */

/** How long before `start_time` role sign-ups and withdrawals close. */
export const ROLE_CUTOFF_MS = 60 * 60 * 1000

/** Epoch ms at which the window closes for an event starting at `startTime`. */
export function roleCutoffAt(startTime: string): number {
  return new Date(startTime).getTime() - ROLE_CUTOFF_MS
}

/**
 * True once the window has closed. An unparseable `start_time` yields NaN, and
 * every comparison against NaN is false — so a bad timestamp leaves the window
 * OPEN rather than locking every member out of an event nobody can fix.
 */
export function isRoleWindowClosed(startTime: string, now = Date.now()): boolean {
  return now >= roleCutoffAt(startTime)
}

/**
 * Whole minutes left before the window closes, rounded UP so the label never
 * reads "0m" while the slot is still claimable. May be <= 0 once closed; call
 * `isRoleWindowClosed` for the boolean rather than testing this for sign.
 */
export function minutesUntilRoleCutoff(startTime: string, now = Date.now()): number {
  return Math.ceil((roleCutoffAt(startTime) - now) / 60_000)
}
