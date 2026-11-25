import { z } from 'zod'
import { adminAction, adminCaller, cancelPreview, cancelSession, respond } from '@/lib/server/tickets/admin'

/** Up to 100 Zoom calls. */
export const maxDuration = 60

export const POST = adminAction(z.object({}), (deps, id) => cancelSession(deps, id))

/** What cancelling would do. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await adminCaller()
  if (caller.response) return caller.response
  const id = z.uuid().safeParse((await params).id)
  if (!id.success) return Response.json({ error: 'Invalid request', code: 'invalid_input' }, { status: 400 })
  return respond(() => cancelPreview(caller.deps, id.data))
}
