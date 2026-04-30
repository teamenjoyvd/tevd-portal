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

  // Profile not found (Clerk user exists but no profile row yet) — show client
  // with null identity; ProfileClient will render skeleton until profile exists.
  return (
    <ProfileClient
      profileId={data?.id ?? null}
      role={data?.role ?? null}
      aboNumber={data?.abo_number ?? null}
    />
  )
}
