import { z } from 'zod'
import { adminCaller, anonymisePerson, respond } from '@/lib/server/tickets/admin'

const bodySchema = z.object({ email: z.email().max(320) })

export async function POST(req: Request) {
  const caller = await adminCaller()
  if (caller.response) return caller.response
  const body = bodySchema.safeParse(await req.json().catch(() => null))
  if (!body.success) return Response.json({ error: 'Invalid request', code: 'invalid_input' }, { status: 400 })
  return respond(() => anonymisePerson(caller.deps, body.data.email))
}
