import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/supabase/guards'

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const guard = await requireAdmin(userId, supabase)
  if (guard) return guard

  try {
    const payload = await req.json()
    
    // Ensure we are only updating the email_settings key, and upserting it just in case
    const { error } = await supabase
      .from('notification_config')
      .upsert({ key: 'email_settings', value: payload }, { onConflict: 'key' })
      
    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ success: true, email_settings: payload })
  } catch (err: unknown) {
    return Response.json({ error: (err as Error).message }, { status: 400 })
  }
}
