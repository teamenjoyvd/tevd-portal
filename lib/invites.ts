// ── lib/invites.ts — guest-invite status derivation ──────────────────────────
// Single source of truth for guest status + funnel counts, shared by
// InvitesSection.tsx (member-facing table) and InvitesBento.tsx (dashboard stat tile).

export type GuestRow = {
  status:       string
  attended_at:  string | null
  cancelled_at: string | null
}

export type GuestStatus = 'pending' | 'confirmed' | 'attended' | 'cancelled'

// Precedence: attended is terminal and unaffected by cancellation or link
// revocation. Below that, self-cancellation (cancelled_at) always overrides
// a confirmed status. Link revocation only affects guests with no terminal
// state yet (never confirmed, cancelled, or attended).
export function guestStatus(g: GuestRow, linkRevoked: boolean): GuestStatus {
  if (g.attended_at !== null) return 'attended'
  if (g.cancelled_at !== null) return 'cancelled'
  if (g.status === 'confirmed') return 'confirmed'
  if (linkRevoked) return 'cancelled'
  return 'pending'
}

export type Funnel = { registrations: number; confirmed: number; attended: number }

export function computeFunnel(guests: GuestRow[], linkRevoked: boolean): Funnel {
  return guests.reduce<Funnel>(
    (acc, g) => {
      acc.registrations++
      const s = guestStatus(g, linkRevoked)
      if (s === 'confirmed' || s === 'attended') acc.confirmed++
      if (s === 'attended') acc.attended++
      return acc
    },
    { registrations: 0, confirmed: 0, attended: 0 },
  )
}
