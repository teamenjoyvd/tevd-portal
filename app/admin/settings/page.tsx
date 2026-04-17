import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/supabase/guards'
import { EmailSettingsPanel, EmailConfig } from './components/EmailSettingsPanel'
import { EmailLogTable } from './components/EmailLogTable'
import { t } from '@/lib/i18n'

export default async function AdminSettingsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/')

  const supabase = createServiceClient()
  const { data: settingsData } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'email_config')
    .single()

  const config = (settingsData?.value as unknown as EmailConfig) || {
    enabled: false,
    alert_recipient: '',
    notification_types: {},
  }

  return (
    <main className="max-w-[1440px] w-full mx-auto p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--semantic-fg-primary)]">
          {t('admin.settings.pageTitle', 'en')}
        </h1>
        <p className="text-sm text-[var(--semantic-fg-secondary)] mt-1">
          {t('admin.settings.pageDesc', 'en')}
        </p>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-4 w-full flex flex-col gap-6">
          <EmailSettingsPanel initialConfig={config} />
        </section>

        <section className="lg:col-span-8 w-full flex flex-col gap-6">
          <EmailLogTable />
        </section>
      </div>
    </main>
  )
}
