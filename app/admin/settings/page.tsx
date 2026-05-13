import { Suspense } from 'react'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { EmailConfig } from './components/EmailSettingsPanel'
import { EmailTab } from './components/EmailTab'
import { NotificationsTab } from './components/NotificationsTab'
import { RemindersTab, RemindersTabProps } from './components/RemindersTab'
import { SystemTab } from './components/SystemTab'
import { SettingsTabs } from './components/SettingsTabs'

const PAGE_SIZE = 50
const VALID_TABS = ['email', 'notifications', 'reminders', 'system'] as const
type TabValue = typeof VALID_TABS[number]

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const sb = createServiceClient()
  const { data: profile } = await sb
    .from('profiles')
    .select('role')
    .eq('clerk_id', userId)
    .single()
  if (profile?.role !== 'admin') redirect('/')

  const { tab: rawTab, page: pageParam } = await searchParams
  const tab: TabValue = VALID_TABS.includes(rawTab as TabValue) ? (rawTab as TabValue) : 'email'
  const page = Math.max(1, parseInt(pageParam ?? '1', 10))

  // Fetch data only for the active tab
  let emailConfig: EmailConfig = { enabled: false, alert_recipient: '', notification_types: {} }
  let notificationsData: { rows: Parameters<typeof NotificationsTab>[0]['rows']; count: number } = { rows: [], count: 0 }
  let remindersData: RemindersTabProps = {
    globalToggles: { reminders_1hr_enabled: true, reminders_15min_enabled: true },
    reminders: [],
  }

  if (tab === 'email') {
    const { data } = await sb.from('settings').select('value').eq('key', 'email_config').single()
    emailConfig = (data?.value as unknown as EmailConfig) ?? emailConfig
  }

  if (tab === 'notifications') {
    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const { data, count } = await sb
      .from('notifications')
      .select('id, created_at, type, title, is_read, deleted_at, profiles!notifications_profile_id_fkey(first_name, last_name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)
    notificationsData = {
      rows: (data ?? []) as Parameters<typeof NotificationsTab>[0]['rows'],
      count: count ?? 0,
    }
  }

  if (tab === 'reminders') {
    // Read global toggles
    const { data: settingsRows } = await sb
      .from('settings')
      .select('key, value')
      .in('key', ['reminders_1hr_enabled', 'reminders_15min_enabled'])

    const settingsMap = Object.fromEntries((settingsRows ?? []).map(r => [r.key, r.value]))
    const globalToggles = {
      reminders_1hr_enabled: settingsMap['reminders_1hr_enabled'] !== 'false',
      reminders_15min_enabled: settingsMap['reminders_15min_enabled'] !== 'false',
    }

    const { data: reminders } = await sb
      .from('scheduled_reminders')
      .select(`
        id, reminder_type, send_at, sent_at, event_id,
        calendar_events!event_id ( id, title, start_time, reminders_enabled ),
        guest_registrations!registration_id ( name, email )
      `)
      .order('send_at', { ascending: false })
      .limit(500)

    remindersData = {
      globalToggles,
      reminders: (reminders ?? []) as RemindersTabProps['reminders'],
    }
  }

  return (
    <main className="max-w-[1440px] w-full mx-auto p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Settings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Email, notifications, reminder config, and system settings.</p>
      </div>

      <Suspense>
        <SettingsTabs tab={tab}>
          {tab === 'email' && <EmailTab config={emailConfig} />}
          {tab === 'notifications' && <NotificationsTab rows={notificationsData.rows} page={page} count={notificationsData.count} />}
          {tab === 'reminders' && <RemindersTab {...remindersData} />}
          {tab === 'system' && <SystemTab />}
        </SettingsTabs>
      </Suspense>
    </main>
  )
}
