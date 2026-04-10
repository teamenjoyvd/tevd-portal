import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { ApprovalHubClient } from './components/ApprovalHubClient'

export default async function ApprovalHubPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()

  const { data: registrations } = await supabase
    .from('trip_registrations')
    .select('id, created_at, trip_id, profile:profiles!profile_id(id, first_name, last_name, abo_number), trip:trips!trip_id(id, title, destination, start_date)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  return (
    <div className="py-8 pb-16">
      <div className="max-w-[720px] mx-auto px-4 space-y-4">
        <div>
          <p
            className="text-xs font-semibold tracking-widest uppercase mb-1"
            style={{ color: 'var(--brand-crimson)' }}
          >
            Admin
          </p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Approval Hub
          </h1>
        </div>
        <ApprovalHubClient initialRegistrations={registrations ?? []} />
      </div>
    </div>
  )
}
