import { z } from 'zod'
import { adminCaller, respond } from '@/lib/server/tickets/admin'
import { listPasses } from '@/lib/server/tickets/admin-views'

const bodySchema = z.object({ q: z.string().max(100) })

/** Reads only. POST keeps names, emails and codes out of URLs and logs. */
export async function POST(req: Request) {
  const caller = await adminCaller()
  if (caller.response) return caller.response
  const body = bodySchema.safeParse(await req.json().catch(() => null))
  if (!body.success) return Response.json({ error: 'Invalid request', code: 'invalid_input' }, { status: 400 })
  return respond(() => listPasses(caller.deps.supabase, body.data.q))
}
