import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerContext } from '@/lib/supabase/guards'
import { redirect } from 'next/navigation'
import AdminNav from '@/app/admin/components/AdminNav'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()
  const ctx = await getCallerContext(userId, supabase, 'admin')
  if (ctx.guard) redirect('/')

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-card)' }}>
      <AdminNav />
      <main className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
