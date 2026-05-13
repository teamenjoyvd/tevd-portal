import { redirect } from 'next/navigation'

export default function AdminEventRemindersPage() {
  redirect('/admin/settings?tab=reminders')
}
