import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerContext } from '@/lib/supabase/guards'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const ctx = await getCallerContext(userId, supabase, 'admin')
  if (ctx.guard) return ctx.guard

  const { data } = await supabase
    .from('notification_config')
    .select('value')
    .eq('key', 'calendar_sync_status')
    .maybeSingle()

  return Response.json(data?.value ?? null)
}

export async function POST() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const ctx = await getCallerContext(userId, supabase, 'admin')
  if (ctx.guard) return ctx.guard

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-google-calendar`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sync-secret': process.env.SYNC_SECRET!,
      },
      body: JSON.stringify({}),
    }
  )

  const data = await res.json()
  return Response.json(data, { status: res.ok ? 200 : 500 })
}