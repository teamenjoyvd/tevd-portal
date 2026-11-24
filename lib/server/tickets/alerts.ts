import type { createServiceClient } from '@/lib/supabase/service'

/** In-app alert to every admin. Never throws: an alert must not undo the work it reports. */
export async function alertAdmins(supabase: ReturnType<typeof createServiceClient>, message: string): Promise<void> {
  const { data: admins, error } = await supabase.from('profiles').select('id').eq('role', 'admin')
  if (error || admins.length === 0) {
    console.error('[tickets] no admins to alert', error?.message)
    return
  }
  const { error: insertError } = await supabase.from('member_notifications').insert(
    admins.map((a) => ({
      profile_id: a.id,
      type: 'ticket_alert' as const,
      title: 'Ticket needs attention',
      message,
      action_url: '/admin/tickets',
    })),
  )
  if (insertError) console.error('[tickets] admin alert failed', insertError.message)
}
