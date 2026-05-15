// Shared domain types and constants for the operations area.
// Plain TypeScript — no 'use client' directive.
//
// Trip and Milestone have moved to lib/types/trips.ts
// PayableItem and ItemFormState have moved to lib/types/items.ts
// ALL_ROLES and MemberRole live in lib/roles.ts — import from there

export type { Trip, Milestone } from '@/lib/types/trips'
export type { MemberRole as Role } from '@/lib/roles'
export type { PayableItem, ItemFormState } from '@/lib/types/items'

export type MembersResponse = {
  los_members: { profile: { id: string; first_name: string; last_name: string; abo_number: string | null } | null }[]
  manual_members_no_abo: { id: string; first_name: string; last_name: string; upline_abo_number: string | null }[]
}

export type MemberProfile = { id: string; first_name: string; last_name: string; abo_number: string | null }
