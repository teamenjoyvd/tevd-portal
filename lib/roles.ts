import type { Database } from '@/types/supabase'

/**
 * Canonical member role type — derived directly from the Supabase-generated
 * `user_role` enum so it stays in sync after every `generate_typescript_types`
 * run. Never declare this union manually elsewhere.
 */
export type MemberRole = Database['public']['Enums']['user_role']

/**
 * ROLE_MAP uses a `Record<MemberRole, 1>` constraint so that TypeScript emits
 * a compile error if any enum member is missing or extra after a migration
 * regenerates `types/supabase.ts`. This is the single source of truth for the
 * ordered role list.
 *
 * Order: least-privileged → most-privileged (matches display convention).
 */
const ROLE_MAP: Record<MemberRole, 1> = {
  guest:  1,
  member: 1,
  core:   1,
  admin:  1,
}

/**
 * All roles as a typed array. Safe to spread into Supabase array columns,
 * visibility_roles defaults, and UI role pickers.
 *
 * Frozen to prevent accidental runtime mutation of this global constant.
 * Spread at call sites when a mutable array is required: `[...ALL_ROLES]`.
 *
 * The `Object.keys` cast is intentional and safe: keys are exactly the enum
 * members by construction of the Record constraint above.
 */
export const ALL_ROLES = Object.freeze(Object.keys(ROLE_MAP)) as readonly MemberRole[]
