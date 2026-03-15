import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_id', userId)
    .single()

  if (profile?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

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