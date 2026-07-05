'use server'

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

async function requireAdminAuth() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const sb = createServiceClient()
  const { data: profile } = await sb
    .from('profiles')
    .select('role')
    .eq('clerk_id', userId)
    .single()
  if (profile?.role !== 'admin') redirect('/')
  return sb
}

// ---------------------------------------------------------------------------
// toggleGlobalReminder
// Toggles reminders_1hr_enabled or reminders_15min_enabled in settings.
// ---------------------------------------------------------------------------
export async function toggleGlobalReminder(
  key: 'reminders_1hr_enabled' | 'reminders_15min_enabled',
  enabled: boolean,
) {
  const sb = await requireAdminAuth()
  await sb
    .from('settings')
    .upsert({ key, value: enabled ? 'true' : 'false' })
  revalidatePath('/admin/settings')
}

// ---------------------------------------------------------------------------
// toggleEventReminders
// Sets calendar_events.reminders_enabled for a specific event.
// ---------------------------------------------------------------------------
export async function toggleEventReminders(eventId: string, enabled: boolean) {
  const sb = await requireAdminAuth()
  await sb
    .from('calendar_events')
    .update({ reminders_enabled: enabled })
    .eq('id', eventId)
  revalidatePath('/admin/settings')
  revalidatePath(`/admin/calendar/${eventId}`)
}

// ---------------------------------------------------------------------------
// cancelReminder
// Deletes a scheduled reminder from notification_queue where status is pending or failed.
// ---------------------------------------------------------------------------
export async function cancelReminder(reminderId: string) {
  const sb = await requireAdminAuth()
  await sb
    .from('notification_queue')
    .delete()
    .eq('id', reminderId)
    .in('status', ['pending', 'failed'])
  revalidatePath('/admin/settings')
}

// ---------------------------------------------------------------------------
// resendReminder
// Resets status to pending, attempts to 0, sent_at to null, last_error to null,
// and sets send_at = now() so the background worker retries it.
// ---------------------------------------------------------------------------
export async function resendReminder(reminderId: string) {
  const sb = await requireAdminAuth()
  await sb
    .from('notification_queue')
    .update({
      status: 'pending',
      attempts: 0,
      sent_at: null,
      last_error: null,
      send_at: new Date().toISOString(),
    })
    .eq('id', reminderId)
  revalidatePath('/admin/settings')
}

// ---------------------------------------------------------------------------
// rescheduleReminder
// Updates send_at to the provided ISO string. Rejects past times.
// ---------------------------------------------------------------------------
export async function rescheduleReminder(reminderId: string, newSendAt: string) {
  if (new Date(newSendAt) <= new Date()) {
    throw new Error('Rescheduled time must be in the future')
  }
  const sb = await requireAdminAuth()
  await sb
    .from('notification_queue')
    .update({
      send_at: newSendAt,
      status: 'pending',
      attempts: 0,
      sent_at: null,
      last_error: null,
    })
    .eq('id', reminderId)
  revalidatePath('/admin/settings')
}
