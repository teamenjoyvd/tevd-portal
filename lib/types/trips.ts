// Canonical Trip and Milestone types.
// ALL_ROLES and MemberRole live in lib/roles.ts — do not re-declare here.
import type { MemberRole } from '@/lib/roles'

export type Milestone = { label: string; amount: number; due_date: string }

export type Trip = {
  id: string
  title: string
  destination: string
  start_date: string
  end_date: string
  total_cost: number
  milestones: Milestone[]
  currency: string
  description: string
  image_url: string | null
  location: string | null
  accommodation_type: string | null
  inclusions: string[]
  trip_type: string | null
  access_roles: MemberRole[]
}
