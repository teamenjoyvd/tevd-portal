/**
 * D3 gating rule: who may see calendar_events.meeting_url.
 *
 * `allow_guest_registration` is NOT NULL DEFAULT false (20260410000001:6), so
 * the gate applies only to events explicitly opened for guest sharing.
 * Ordinary internal events keep today's behaviour (link always visible to
 * non-guests).
 */
export function canSeeMeetingUrl(a: {
  role: string
  allowGuestRegistration: boolean
  hasActiveRegistration: boolean
}): boolean {
  if (a.role === 'guest') return false                  // anonymous/guest: never
  if (a.role === 'admin') return true                    // admin: always
  if (a.allowGuestRegistration !== true) return true      // legacy behaviour preserved
  return a.hasActiveRegistration
}
