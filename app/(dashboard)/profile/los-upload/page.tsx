import { redirect } from 'next/navigation'
import { loadProfile } from '@/lib/server/ensure-profile'
import { LosUploadClient } from './LosUploadClient'

// CORE self-service LOS upload. CORE (and admin) only; a member without a
// verified ABO can't be scoped, so they see a prompt to verify first.
export default async function LosUploadPage() {
  const { profile } = await loadProfile<{
    id: string
    role: string
    abo_number: string | null
  }>('id, role, abo_number')

  if (profile.role !== 'core' && profile.role !== 'admin') redirect('/profile')

  return <LosUploadClient aboNumber={profile.abo_number ?? null} />
}
