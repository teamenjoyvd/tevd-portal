import { redirect } from 'next/navigation'
// ISS-0149: merged into /admin/members tab shell
export default function DataCenterPage() {
  redirect('/admin/members')
}
