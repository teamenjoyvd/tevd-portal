import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/supabase/guards'
import { EmailSettingsPanel } from './components/EmailSettingsPanel'
import { EmailLogTable } from './components/EmailLogTable'

export default async function AdminSettingsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/')

  const supabase = createServiceClient()
  const guard = await requireAdmin(userId, supabase)
  if (guard) return guard

  // Fetch current settings
  const { data: settingsData } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'email_config')
    .single()

  const config = settingsData?.value || {
    enabled: false,
    alert_recipient: '',
    notification_types: {},
  }

  // Dual layout is canonical in the code base: lg:grid lg:grid-cols-12 gap-6
  return (
    <main className="max-w-[1440px] w-full mx-auto p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--semantic-fg-primary)]">
          System Settings
        </h1>
        <p className="text-sm text-[var(--semantic-fg-secondary)] mt-1">
          Manage global configurations and monitor automated systems
        </p>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 items-start">
        {/* Left Col: Settings Form */}
        <section className="lg:col-span-4 w-full flex flex-col gap-6">
          <EmailSettingsPanel initialConfig={config} />
        </section>

        {/* Right Col: Logs */}
        <section className="lg:col-span-8 w-full flex flex-col gap-6">
          <EmailLogTable />
        </section>
      </div>
    </main>
  )
}
