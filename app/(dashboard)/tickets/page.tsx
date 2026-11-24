import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { MyTicketsClient } from './components/MyTicketsClient'

export default async function MyTicketsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  return <MyTicketsClient />
}
