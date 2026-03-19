import { redirect } from 'next/navigation'
// Deprecated — howtos renamed to guides (ISS-0144)
export default function HowtosPage() {
  redirect('/guides')
}
