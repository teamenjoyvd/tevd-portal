import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req: Request) => {
  const secret = Deno.env.get('SYNC_SECRET')
  if (!secret || req.headers.get('x-sync-secret') !== secret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Missing environment variables' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // 1. Delete sent/permanently_failed notifications in 'notification_queue' older than 30 days
  const { data: qDeleted, error: qErr } = await supabase
    .from('notification_queue')
    .delete()
    .in('status', ['sent', 'permanently_failed'])
    .lt('created_at', thirtyDaysAgo)
    .select('id')

  // 2. Delete logs in 'notification_delivery_log' older than 30 days
  const { data: logDeleted, error: logErr } = await supabase
    .from('notification_delivery_log')
    .delete()
    .lt('created_at', thirtyDaysAgo)
    .select('id')

  // 3. Delete soft-deleted notifications in 'member_notifications' older than 30 days
  const { data: memberDeleted, error: memberErr } = await supabase
    .from('member_notifications')
    .delete()
    .not('deleted_at', 'is', null)
    .lt('deleted_at', thirtyDaysAgo)
    .select('id')

  if (qErr || logErr || memberErr) {
    return new Response(
      JSON.stringify({
        error: 'Cleanup failed',
        details: {
          queue_error: qErr?.message,
          log_error: logErr?.message,
          member_error: memberErr?.message,
        },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({
      message: 'Cleanup completed successfully',
      deleted: {
        queue_count: qDeleted?.length ?? 0,
        log_count: logDeleted?.length ?? 0,
        member_count: memberDeleted?.length ?? 0,
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
