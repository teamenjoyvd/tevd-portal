import { redirect } from 'next/navigation'
// Deprecated — howtos renamed to guides (ISS-0144)
export default function HowtosAdminPage() {
  redirect('/admin/guides')
}
