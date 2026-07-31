import { redirect } from 'next/navigation'

// Items were extracted out of /admin/operations into their own section (#370)
export default function PayableItemsRedirect() {
  redirect('/admin/items')
}
