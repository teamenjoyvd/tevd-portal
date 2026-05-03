// Shared domain types and constants for the operations area.
// Plain TypeScript — no 'use client' directive.

export const ALL_ROLES = ['guest', 'member', 'core', 'admin'] as const
export type Role = (typeof ALL_ROLES)[number]

export type Milestone = { label: string; amount: number; due_date: string }

export type Trip = {
  id: string; title: string; destination: string
  start_date: string; end_date: string
  total_cost: number; milestones: Milestone[]
  currency: string; description: string
  location: string | null; accommodation_type: string | null
  inclusions: string[]; trip_type: string | null
  access_roles: Role[]
}

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
