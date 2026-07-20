import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { InvitesSection } from '../components/InvitesSection'

export default async function ProfileInvitesPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <div className="py-8 pb-16 px-4 md:px-6 xl:px-8 md:max-w-[1280px] md:mx-auto">
      {/* Back link */}
      <Link
        href="/profile"
        className="inline-flex items-center gap-1 text-xs font-semibold mb-3 md:mb-5 hover:opacity-70 transition-opacity"
        style={{ color: 'var(--text-secondary)' }}
      >
        ← Back to Profile
      </Link>

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
