import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { ProfileClient } from './components/ProfileClient'

export default async function ProfilePage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, role, abo_number')
    .eq('clerk_id', userId)
    .single()

  // No profile row — Clerk webhook missed or first-sign-up race.
  // Redirect rather than rendering a skeleton that never resolves.
  if (!data) redirect('/')

  return (
    <ProfileClient
      profileId={data.id}
      role={data.role}
      aboNumber={data.abo_number ?? null}
    />
  )
}
