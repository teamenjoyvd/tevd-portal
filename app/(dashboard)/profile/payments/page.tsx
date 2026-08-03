import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { ProfileBackLink } from '../components/ProfileBackLink'
import { PaymentsLedgerClient } from './PaymentsLedgerClient'

export default async function ProfilePaymentsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <div className="py-8 pb-16 px-4 md:px-6 xl:px-8 md:max-w-[1280px] md:mx-auto">
      <ProfileBackLink />
      <PaymentsLedgerClient />
    </div>
  )
}
