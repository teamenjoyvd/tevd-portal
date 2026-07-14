import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { LosUploadClient } from './LosUploadClient'

// CORE self-service LOS upload. CORE (and admin) only; a member without a
// verified ABO can't be scoped, so they see a prompt to verify first.
export default async function LosUploadPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, role, abo_number')
    .eq('clerk_id', userId)
    .single()

  if (!data) redirect('/')
  if (data.role !== 'core' && data.role !== 'admin') redirect('/profile')

  return <LosUploadClient aboNumber={data.abo_number ?? null} />
}
