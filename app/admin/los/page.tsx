import { redirect } from 'next/navigation'
// ISS-0149: merged into /admin/members tab shell
export default function AdminLOSPage() {
  redirect('/admin/members')
}
