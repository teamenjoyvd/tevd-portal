import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('clerk_id', userId).single()

  if (profile?.role !== 'admin') redirect('/')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#2d332a] text-white px-6 py-3 flex items-center gap-6">
        <span className="font-semibold text-sm tracking-wide">Admin</span>
        <nav className="flex gap-4 text-sm">
          {[
            { href: '/admin/approval-hub',  label: 'Approval Hub' },
            { href: '/admin/operations',    label: 'Operations'   },
            { href: '/admin/content',       label: 'Content'      },
            { href: '/admin/data-center',   label: 'Data Center'  },
          ].map(({ href, label }) => (
            <a key={href} href={href} className="text-white/70 hover:text-white transition-colors">
              {label}
            </a>
          ))}
        </nav>
      </div>
      <main>{children}</main>
    </div>
  )
}