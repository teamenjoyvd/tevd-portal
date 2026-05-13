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
// Deletes a pending (unsent) scheduled_reminder row.
// ---------------------------------------------------------------------------
export async function cancelReminder(reminderId: string) {
  const sb = await requireAdminAuth()
  await sb
    .from('scheduled_reminders')
    .delete()
    .eq('id', reminderId)
    .is('sent_at', null) // only pending rows
  revalidatePath('/admin/settings')
}

// ---------------------------------------------------------------------------
// resendReminder
// Resets sent_at to null and sets send_at = now() so the cron picks it up
// immediately on the next run.
// ---------------------------------------------------------------------------
export async function resendReminder(reminderId: string) {
  const sb = await requireAdminAuth()
  await sb
    .from('scheduled_reminders')
    .update({ sent_at: null, send_at: new Date().toISOString() })
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
    .from('scheduled_reminders')
    .update({ send_at: newSendAt, sent_at: null })
    .eq('id', reminderId)
  revalidatePath('/admin/settings')
}
