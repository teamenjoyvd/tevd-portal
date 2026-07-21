import { loadProfile } from '@/lib/server/ensure-profile'
import { ProfileClient } from './components/ProfileClient'

export default async function ProfilePage() {
  // loadProfile self-heals a missing row (Clerk webhook race / miss) rather
  // than bouncing a freshly-registered guest to home — this page is the guest's
  // "confirm your profile" onboarding step. Single embedded-count query:
  // event_share_links has one FK to profiles (profile_id), so the embed works.
  const { profile } = await loadProfile<{
    id: string
    role: string
    abo_number: string | null
    event_share_links: { count: number }[]
  }>('id, role, abo_number, event_share_links(count)')

  const invitesCount = profile.event_share_links?.[0]?.count ?? 0

  return (
    <ProfileClient
      profileId={profile.id}
      role={profile.role}
      aboNumber={profile.abo_number ?? null}
      hasInvites={invitesCount > 0}
    />
  )
}
