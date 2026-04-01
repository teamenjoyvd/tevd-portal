import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}): Promise<React.ReactElement> {
  const { userId } = await auth()
  // Middleware guarantees userId is present for /admin/* — this is a safety net.
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_id', userId)
    .single()

  if (profile?.role !== 'admin') redirect('/')

  return <>{children}</>
}
