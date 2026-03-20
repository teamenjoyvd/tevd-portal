import { redirect } from 'next/navigation'

export default function GuidesAdminRedirect() {
  redirect('/admin/content?tab=guides')
}
