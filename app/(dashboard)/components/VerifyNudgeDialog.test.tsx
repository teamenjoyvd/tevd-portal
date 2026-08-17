// @vitest-environment jsdom
// The module under test is a 'use client' component pulling in Clerk, react-query
// and next/link at module scope. Only the two pure decision functions are
// exercised here — they are what encodes the ticket's five-state matrix, and
// getting that matrix wrong is the failure mode that matters (2608-DEV-742).

import { describe, it, expect } from 'vitest'
import { selectVariant, isSnoozed } from './VerifyNudgeDialog'
import type { Profile } from '../profile/types'

const BASE = {
  role: 'guest',
  primary_profile_id: null,
  verRequest: null,
  ownSpouseLinkRequest: null,
  pendingSpouseLinkCount: 0,
} as unknown as Profile

const profile = (over: Partial<Profile>): Profile => ({ ...BASE, ...over })

describe('selectVariant — the five states', () => {
  it('state 1: a guest who never submitted anything is nudged to verify', () => {
    expect(selectVariant(profile({}))).toBe('verify')
  })

  it('state 2: a guest whose request is under review is left alone', () => {
    expect(selectVariant(profile({ verRequest: { status: 'pending' } as Profile['verRequest'] }))).toBeNull()
  })

  it('state 3: a denied guest is told it needs attention', () => {
    expect(selectVariant(profile({ verRequest: { status: 'denied' } as Profile['verRequest'] }))).toBe('denied')
  })

  it('state 4: a guest waiting on their primary is NOT told to verify an ABO', () => {
    // The whole reason /api/profile grows ownSpouseLinkRequest: without it this
    // profile is indistinguishable from state 1, and secondaries are hard-blocked
    // from self-verifying (verify-abo/route.ts:27-35).
    expect(selectVariant(profile({
      ownSpouseLinkRequest: { status: 'pending' } as Profile['ownSpouseLinkRequest'],
    }))).toBeNull()
  })

  it('state 5: a primary with an inbound request is asked to approve it', () => {
    expect(selectVariant(profile({ role: 'member', pendingSpouseLinkCount: 1 }))).toBe('approve-spouse')
  })
})

describe('selectVariant — who is left alone', () => {
  it('a guest already linked to a primary gets nothing', () => {
    expect(selectVariant(profile({ primary_profile_id: 'abc' }))).toBeNull()
  })

  it('a denied outbound spouse request does not suppress the verify nudge', () => {
    // Only a *pending* request means "waiting"; a denied one means they are stuck
    // again and the verify path is once more the right thing to point at.
    expect(selectVariant(profile({
      ownSpouseLinkRequest: { status: 'denied' } as Profile['ownSpouseLinkRequest'],
    }))).toBe('verify')
  })

  it.each(['member', 'core', 'admin'])('a %s with nothing pending is never nudged', role => {
    expect(selectVariant(profile({ role: role as Profile['role'] }))).toBeNull()
  })

  it('an approved-but-not-yet-promoted guest is left alone', () => {
    expect(selectVariant(profile({ verRequest: { status: 'approved' } as Profile['verRequest'] }))).toBeNull()
  })

  it('a guest with a pending inbound count is still a verify case, not state 5', () => {
    // Guests cannot receive inbound requests, but the count must not be able to
    // hijack the guest branch if that ever changes.
    expect(selectVariant(profile({ pendingSpouseLinkCount: 3 }))).toBe('verify')
  })
})

describe('isSnoozed', () => {
  const NOW = Date.parse('2026-08-17T12:00:00.000Z')
  const daysAgo = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString()

  it('is not snoozed when nothing was ever dismissed', () => {
    expect(isSnoozed(undefined, NOW)).toBe(false)
    expect(isSnoozed({}, NOW)).toBe(false)
  })

  it('is snoozed inside the 7-day window', () => {
    expect(isSnoozed({ verify_dismissed_at: daysAgo(1) }, NOW)).toBe(true)
    expect(isSnoozed({ verify_dismissed_at: daysAgo(6.9) }, NOW)).toBe(true)
  })

  it('is not snoozed once the window has passed', () => {
    expect(isSnoozed({ verify_dismissed_at: daysAgo(7.1) }, NOW)).toBe(false)
    expect(isSnoozed({ verify_dismissed_at: daysAgo(30) }, NOW)).toBe(false)
  })

  it('a malformed timestamp does not suppress the nudge forever', () => {
    expect(isSnoozed({ verify_dismissed_at: 'not-a-date' }, NOW)).toBe(false)
  })
})
