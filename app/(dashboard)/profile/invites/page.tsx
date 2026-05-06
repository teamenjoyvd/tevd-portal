import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { InvitesSection } from '../components/InvitesSection'

export default async function ProfileInvitesPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <div className="py-8 pb-16">

      {/* ════════════════════════════════════════════════════════════════════
          DESKTOP layout (md+)
          Single centred column, max-w-[1280px]
          ════════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:block max-w-[1280px] mx-auto px-6 xl:px-8">
        {/* Back link */}
        <Link
          href="/profile"
          className="inline-flex items-center gap-1 text-xs font-semibold mb-5 hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-secondary)' }}
        >
          ← Back to Profile
        </Link>

        {/* Full invites section — no bento wrapper */}
        <div
          className="rounded-2xl"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
          }}
        >
          <InvitesSection />
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          MOBILE layout (< md)
          Full-width, no horizontal padding on the card
          ════════════════════════════════════════════════════════════════════ */}
      <div className="md:hidden flex flex-col gap-3 px-4">
        {/* Back link */}
        <Link
          href="/profile"
          className="inline-flex items-center gap-1 text-xs font-semibold hover:opacity-70 transition-opacity"
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

    </div>
  )
}
