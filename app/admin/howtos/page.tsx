import { redirect } from 'next/navigation'
// Deprecated — howtos renamed to guides (ISS-0144), which now lives under /admin/content
export default function HowtosAdminPage() {
  redirect('/admin/content?tab=guides')
}
