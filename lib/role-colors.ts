// Role color palette — single source of truth.
// Safe for both server and client imports (no 'use server' / 'use client').

export type RoleColorEntry = { bg: string; font: string }

// Consumed only by DOM badges (UserDropdown, MembersTable, LosTab, AttendeeView,
// AboInfoContent), so these resolve as CSS variables. The literals they replace
// were off-palette by enough to read as a different brand (#DC143C vs the
// brand's #bc4749, #008080 vs #3E7785) and the guest chip's fixed #e8e4dc/#2d2d2d
// pair was a light chip that stayed light in dark mode.
export const ROLE_COLORS: Record<string, RoleColorEntry> = {
  admin:  { bg: 'var(--brand-crimson)', font: 'var(--on-accent)' },
  core:   { bg: 'var(--brand-teal)',    font: 'var(--on-accent)' },
  member: { bg: 'var(--brand-forest)',  font: 'var(--on-accent)' },
  guest:  { bg: 'var(--hover-surface)', font: 'var(--text-secondary)' },
}

/** Returns the color entry for a given role, defaulting to guest. */
export function getRoleColors(role: string): RoleColorEntry {
  return ROLE_COLORS[role] ?? ROLE_COLORS.guest
}
