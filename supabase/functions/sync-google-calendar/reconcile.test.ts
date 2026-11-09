/**
 * [2608-DEV-764] Regression tests for what the Google sync may delete.
 *
 * The first two tests in each block are the bug itself: against the rule this
 * replaced ("delete every window row Google did not return") they fail.
 */
import { describe, expect, it } from 'vitest'

import {
  partitionDeletable,
  planReconciliation,
  type WindowRow,
} from './reconcile.ts'

const row = (over: Partial<WindowRow> & { id: string }): WindowRow => ({
  google_event_id: `g-${over.id}`,
  source: 'google',
  ...over,
})

describe('planReconciliation', () => {
  it('never puts a row Google simply did not return into the delete set', () => {
    // THE BUG. Google answered 200 with a partial list — a successful response
    // is not an inventory. The old rule read this absence as a deletion and
    // cascaded the registrations away.
    const rows = [row({ id: 'a' }), row({ id: 'b' })]

    const plan = planReconciliation(rows, new Set(['g-a']), new Set())

    expect(plan.cancelled).toEqual([])
    expect(plan.absent).toEqual([rows[1]])
  })

  it('leaves a Zoom-sourced row alone even though Google never returns it', () => {
    // 2611-DEV-774 imports Zoom sessions into calendar_events. Every one of
    // them is absent from every Google response, for good.
    const zoom = row({ id: 'z', source: 'zoom' })

    const plan = planReconciliation([zoom], new Set(), new Set())

    expect(plan.cancelled).toEqual([])
    expect(plan.absent).toEqual([])
    expect(plan.foreign).toEqual([zoom])
  })

  it('deletes only what Google explicitly marked cancelled', () => {
    const gone = row({ id: 'gone' })
    const live = row({ id: 'live' })

    // showDeleted=true means a cancelled event is still in the fetched list.
    const plan = planReconciliation(
      [gone, live],
      new Set(['g-gone', 'g-live']),
      new Set(['g-gone']),
    )

    expect(plan.cancelled).toEqual([gone])
    expect(plan.absent).toEqual([])
    expect(plan.foreign).toEqual([])
  })

  it('treats an empty Google response as zero deletions, not a full wipe', () => {
    const rows = [row({ id: 'a' }), row({ id: 'b' }), row({ id: 'c' })]

    const plan = planReconciliation(rows, new Set(), new Set())

    expect(plan.cancelled).toEqual([])
    expect(plan.absent).toEqual(rows)
  })

  it('classifies a cancelled row as cancelled even if it is also absent', () => {
    // Defensive: a cancelled id that the fetched set somehow lacks is still an
    // explicit deletion signal, and must not be demoted to "absent".
    const gone = row({ id: 'gone' })

    const plan = planReconciliation([gone], new Set(), new Set(['g-gone']))

    expect(plan.cancelled).toEqual([gone])
    expect(plan.absent).toEqual([])
  })

  it('never reports a portal-created event as absent', () => {
    const portal = row({ id: 'p', source: 'portal' })

    expect(planReconciliation([portal], new Set(), new Set()).foreign).toEqual([
      portal,
    ])
  })
})

describe('partitionDeletable', () => {
  it('blocks a cancelled event that still has registrations', () => {
    const withGuests = row({ id: 'with' })

    const split = partitionDeletable([withGuests], new Set(['with']))

    expect(split.blocked).toEqual([withGuests])
    expect(split.deletable).toEqual([])
  })

  it('does not let one protected event block the other deletions', () => {
    // A bulk .in() delete is one statement: without this split, a single
    // RESTRICT violation would fail the whole batch and nothing would be
    // reconciled, run after run.
    const protectedRow = row({ id: 'with' })
    const free = [row({ id: 'free1' }), row({ id: 'free2' })]

    const split = partitionDeletable(
      [free[0], protectedRow, free[1]],
      new Set(['with']),
    )

    expect(split.deletable).toEqual(free)
    expect(split.blocked).toEqual([protectedRow])
  })

  it('matches on calendar_events.id, not google_event_id', () => {
    // guest_registrations.event_id is the uuid. Comparing the wrong key would
    // silently mark every protected event deletable.
    const r = row({ id: 'uuid-1' })

    expect(partitionDeletable([r], new Set(['g-uuid-1'])).deletable).toEqual([r])
    expect(partitionDeletable([r], new Set(['uuid-1'])).blocked).toEqual([r])
  })

  it('returns two empty lists for no candidates', () => {
    expect(partitionDeletable([], new Set(['anything']))).toEqual({
      deletable: [],
      blocked: [],
    })
  })
})
