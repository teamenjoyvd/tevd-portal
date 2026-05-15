// Operations page removed — all tabs have been extracted into dedicated sections:
// - Trips → /admin/trips (#369)
// - Items → /admin/items (#370)
// - Payments → /admin/payments (#371)
//
// This file is a redirect stub; the route is removed from ADMIN_NAV in lib/nav.ts.
import { redirect } from 'next/navigation'
export default function OperationsPage() {
  redirect('/admin/payments')
}
