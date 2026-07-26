import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { InvitesSection } from '../components/InvitesSection'
import { ProfileBackLink } from '../components/ProfileBackLink'

export default async function ProfileInvitesPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <div className="py-8 pb-16 px-4 md:px-6 xl:px-8 md:max-w-[1280px] md:mx-auto">
      <ProfileBackLink />

      {/* Full invites section */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
        }}
      >
        <InvitesSection />
      </div>
    </div>
  )
}
