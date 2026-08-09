import { describe, expect, it } from 'vitest'
import { canSeeMeetingUrl } from './meeting-url-visibility'

describe('canSeeMeetingUrl', () => {
  it('never shows the link to a guest, regardless of gating or registration', () => {
    expect(canSeeMeetingUrl({ role: 'guest', allowGuestRegistration: true, hasActiveRegistration: true })).toBe(false)
    expect(canSeeMeetingUrl({ role: 'guest', allowGuestRegistration: false, hasActiveRegistration: false })).toBe(false)
  })

  it('always shows the link to an admin, regardless of gating or registration', () => {
    expect(canSeeMeetingUrl({ role: 'admin', allowGuestRegistration: true, hasActiveRegistration: false })).toBe(true)
    expect(canSeeMeetingUrl({ role: 'admin', allowGuestRegistration: false, hasActiveRegistration: false })).toBe(true)
  })

  it('preserves legacy behaviour (always visible) when the event is not open for guest sharing', () => {
    expect(canSeeMeetingUrl({ role: 'member', allowGuestRegistration: false, hasActiveRegistration: false })).toBe(true)
    expect(canSeeMeetingUrl({ role: 'core', allowGuestRegistration: false, hasActiveRegistration: false })).toBe(true)
  })

  it('gates a member/core caller on an active registration when the event allows guest sharing', () => {
    expect(canSeeMeetingUrl({ role: 'member', allowGuestRegistration: true, hasActiveRegistration: true })).toBe(true)
    expect(canSeeMeetingUrl({ role: 'member', allowGuestRegistration: true, hasActiveRegistration: false })).toBe(false)
    expect(canSeeMeetingUrl({ role: 'core', allowGuestRegistration: true, hasActiveRegistration: false })).toBe(false)
  })

  it('treats allowGuestRegistration as a strict boolean check, not truthy — a non-boolean truthy value falls back to legacy (visible)', () => {
    // @ts-expect-error — exercising the runtime guard against a non-boolean truthy value
    expect(canSeeMeetingUrl({ role: 'member', allowGuestRegistration: 1, hasActiveRegistration: false })).toBe(true)
  })
})
