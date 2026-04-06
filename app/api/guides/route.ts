import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getRoleForAccess, listGuidesForRole } from '@/lib/server/guides'

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url)
  const limit = Number(searchParams.get('limit') ?? 100)

  try {
    const role = await getRoleForAccess()
    const data = await listGuidesForRole({ role, limit })
    return Response.json(data)
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
