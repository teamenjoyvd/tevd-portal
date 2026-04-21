import { redirect } from 'next/navigation'

export default function AnnouncementsPage() {
  redirect('/guides?type=news')
}
