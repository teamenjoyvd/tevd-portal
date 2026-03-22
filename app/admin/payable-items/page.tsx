import { redirect } from 'next/navigation'

export default function PayableItemsRedirect() {
  redirect('/admin/operations?tab=items')
}
