// Shared payment types — used by PaymentForm and profile route components.
// Profile types.ts re-exports PayableItem from here.

export type PayableItem = {
  id: string
  title: string
  description: string | null
  amount: number
  currency: string
  item_type: string
}
