import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { PaymentsClient } from './components/PaymentsClient'
import type { Payment } from '@/lib/types/payments'

export const dynamic = 'force-dynamic'

export default async function PaymentsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_id', userId)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/')

  const { data: allPaymentsRaw } = await supabase
    .from('payments')
    .select(
      'id, amount, currency, transaction_date, admin_status, member_status, payment_method, proof_url, note, admin_note, logged_by_admin, created_at, profiles(first_name,last_name,abo_number), trips(title,destination), payable_items(title,item_type,currency)'
    )
    .order('created_at', { ascending: false })

  const allPayments = (allPaymentsRaw ?? []) as Payment[]

  const pendingPayments = allPayments.filter(
    p => p.admin_status === 'pending' && p.logged_by_admin === null
  )

  return (
    <div className="space-y-6 pb-16">

      {/* ════════════════════════════════════════════════════════════════════
          DESKTOP layout (md+)
          ════════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:block">
        <PaymentsClient
          initialPayments={allPayments}
          initialPending={pendingPayments}
        />
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          MOBILE layout (< md)
          ════════════════════════════════════════════════════════════════════ */}
      <div className="md:hidden">
        <PaymentsClient
          initialPayments={allPayments}
          initialPending={pendingPayments}
        />
      </div>

    </div>
  )
}
