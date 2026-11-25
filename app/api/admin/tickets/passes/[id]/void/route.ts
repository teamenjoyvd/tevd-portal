import { z } from 'zod'
import { adminAction, voidPass } from '@/lib/server/tickets/admin'

export const POST = adminAction(z.object({ reason: z.string().trim().min(1).max(500) }), (deps, id, { reason }) => voidPass(deps, id, reason))
