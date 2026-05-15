// Canonical types for payable items.
// Moved here from app/admin/operations/components/operations-types.ts

export const ITEM_TYPES = ['merchandise', 'ticket', 'food', 'book', 'other'] as const
export type ItemType = typeof ITEM_TYPES[number]

export type PayableItem = {
  id: string
  title: string
  description: string | null
  amount: number
  currency: string
  item_type: ItemType
  linked_trip_id: string | null
  is_active: boolean
  created_at: string
  trips: { title: string } | null
}

export type ItemFormState = {
  title: string
  description: string
  amount: string
  currency: string
  item_type: ItemType
  linked_trip_id: string
  is_active: boolean
}
