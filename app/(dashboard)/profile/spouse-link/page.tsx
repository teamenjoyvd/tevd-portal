import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import SpouseLinkClient from './SpouseLinkClient'

export default async function SpouseLinkPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, primary_profile_id')
    .eq('clerk_id', userId)
    .single()

  if (!profile) redirect('/profile')

  // Guests: fetch their own outbound request
  let outboundRequest: {
    id: string
    status: string
    admin_note: string | null
    created_at: string
    claimed_primary: { first_name: string; last_name: string; abo_number: string | null } | null
  } | null = null

  if (profile.role === 'guest' && !profile.primary_profile_id) {
    const { data } = await supabase
      .from('spouse_link_requests')
      .select(`
        id, status, admin_note, created_at,
        claimed_primary:profiles!spouse_link_requests_claimed_primary_id_fkey(first_name, last_name, abo_number)
      `)
      .eq('requester_id', profile.id)
      .maybeSingle()
    outboundRequest = data ?? null
  }

  // Primary members: fetch inbound pending requests
  let inboundRequests: {
    id: string
    status: string
    created_at: string
    requester: { id: string; first_name: string; last_name: string; contact_email: string | null } | null
  }[] = []

  if (profile.role !== 'guest' && !profile.primary_profile_id) {
    const { data } = await supabase
      .from('spouse_link_requests')
      .select(`
        id, status, created_at,
        requester:profiles!spouse_link_requests_requester_id_fkey(id, first_name, last_name, contact_email)
      `)
      .eq('claimed_primary_id', profile.id)
      .eq('status', 'pending')
    inboundRequests = data ?? []
  }

  return (
    <SpouseLinkClient
      profileRole={profile.role}
      isPrimary={!profile.primary_profile_id}
      outboundRequest={outboundRequest}
      inboundRequests={inboundRequests}
    />
  )
}
