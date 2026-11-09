/**
 * [2608-DEV-764] What the Google sync is allowed to delete.
 *
 * This file is deliberately free of imports and of every Deno global, so the
 * same source runs inside the edge function and inside vitest. The rest of
 * `index.ts` cannot be tested — it reads `Deno.env` at module scope and imports
 * `jsr:` specifiers — and the rule that destroyed registrations lived inline in
 * it, untested and unreadable from outside. Keeping the decision pure is the
 * only way it gets covered at all; that is why this is a separate file rather
 * than a function in `index.ts`.
 *
 * THE BUG THIS REPLACES: reconciliation treated "Google did not return this
 * row" as "delete this row". Absence is not a deletion signal. A Google
 * response that succeeds but is incomplete, an event rescheduled past the
 * window's far edge, or any row Google does not own all look identical to a
 * deliberate deletion — and `guest_registrations.event_id` cascaded, so each
 * one took its registrations with it.
 *
 * Google already tells us about real deletions explicitly: the sync requests
 * `showDeleted=true`, so a deleted event comes back with `status: 'cancelled'`.
 * That signal is positive, specific and the only one acted on here.
 */

/** A `calendar_events` row inside the sync window. */
export type WindowRow = {
  /** `calendar_events.id` (uuid) — what the registration FK points at. */
  id: string
  google_event_id: string
  /** 'google' | 'zoom' | 'portal'; typed wide so a new source cannot crash the sync. */
  source: string
}

export type ReconciliationPlan = {
  /** Google explicitly returned these as cancelled. The only delete candidates. */
  cancelled: WindowRow[]
  /**
   * Ours, in the window, and absent from Google's response. NEVER deleted —
   * reported so a human decides. This is the set the old code destroyed.
   */
  absent: WindowRow[]
  /** Rows the sync does not own (Zoom, portal). Never touched, never reported as absent. */
  foreign: WindowRow[]
}

/**
 * Decide what reconciliation may act on. Pure: no IO, no clock, no randomness.
 *
 * @param windowRows   every `calendar_events` row in the sync window
 * @param fetchedIds   every `google_event_id` Google returned, cancelled ones included
 * @param cancelledIds the subset Google returned with `status: 'cancelled'`
 */
export function planReconciliation(
  windowRows: readonly WindowRow[],
  fetchedIds: ReadonlySet<string>,
  cancelledIds: ReadonlySet<string>,
): ReconciliationPlan {
  const plan: ReconciliationPlan = { cancelled: [], absent: [], foreign: [] }

  for (const row of windowRows) {
    // Anything the sync does not own is invisible to it, in both directions:
    // not deletable, and not even reportable as missing. Google will never
    // return a Zoom session, so reporting it would be permanent noise.
    if (row.source !== 'google') {
      plan.foreign.push(row)
      continue
    }
    if (cancelledIds.has(row.google_event_id)) {
      plan.cancelled.push(row)
    } else if (!fetchedIds.has(row.google_event_id)) {
      plan.absent.push(row)
    }
  }

  return plan
}

export type DeletePartition = {
  /** Safe to delete: cancelled in Google and nothing depends on them. */
  deletable: WindowRow[]
  /**
   * Cancelled in Google but holding registrations. The FK (RESTRICT since
   * 2608-DEV-764) would refuse these, and a bulk `.in()` delete fails as one
   * statement — so one protected event would block every other cancellation.
   * Partitioning keeps the safe deletes working and names the rest for an admin.
   */
  blocked: WindowRow[]
}

/**
 * Split delete candidates by whether a registration depends on them.
 *
 * @param candidates          `planReconciliation(...).cancelled`
 * @param eventIdsWithRegistrations `calendar_events.id` values that have at least
 *        one `guest_registrations` row, cancelled registrations included — a
 *        cancelled registration is kept for stats and still blocks the FK.
 */
export function partitionDeletable(
  candidates: readonly WindowRow[],
  eventIdsWithRegistrations: ReadonlySet<string>,
): DeletePartition {
  const partition: DeletePartition = { deletable: [], blocked: [] }
  for (const row of candidates) {
    if (eventIdsWithRegistrations.has(row.id)) partition.blocked.push(row)
    else partition.deletable.push(row)
  }
  return partition
}
