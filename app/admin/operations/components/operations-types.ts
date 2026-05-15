// Shared domain types and constants for the operations area.
// Plain TypeScript — no 'use client' directive.
//
// Trip and Milestone have moved to lib/types/trips.ts
// ALL_ROLES and MemberRole live in lib/roles.ts — import from there

export type { Trip, Milestone } from '@/lib/types/trips'
export type { MemberRole as Role } from '@/lib/roles'

export type PayableItem = {
  id: string
  title: string
  description: string | null
  amount: number
  currency: string
  item_type: 'merchandise' | 'ticket' | 'food' | 'book' | 'other'
  linked_trip_id: string | null
  is_active: boolean
  created_at: string
  trips: { title: string } | null
}

export type MembersResponse = {
  los_members: { profile: { id: string; first_name: string; last_name: string; abo_number: string | null } | null }[]
  manual_members_no_abo: { id: string; first_name: string; last_name: string; upline_abo_number: string | null }[]
}

export type MemberProfile = { id: string; first_name: string; last_name: string; abo_number: string | null }

export type ItemFormState = {
  title: string; description: string; amount: string; currency: string
  item_type: 'merchandise' | 'ticket' | 'food' | 'book' | 'other'
  linked_trip_id: string; is_active: boolean
}
