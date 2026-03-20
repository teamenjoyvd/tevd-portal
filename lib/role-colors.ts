// Role color palette — single source of truth.
// Safe for both server and client imports (no 'use server' / 'use client').

export type RoleColorEntry = { bg: string; font: string }

export const ROLE_COLORS: Record<string, RoleColorEntry> = {
  admin:  { bg: '#DC143C', font: '#faf8f3' },
  core:   { bg: '#008080', font: '#faf8f3' },
  member: { bg: '#1a6b4a', font: '#faf8f3' },
  guest:  { bg: '#e8e4dc', font: '#2d2d2d' },
}

/** Returns the color entry for a given role, defaulting to guest. */
export function getRoleColors(role: string): RoleColorEntry {
  return ROLE_COLORS[role] ?? ROLE_COLORS.guest
}
