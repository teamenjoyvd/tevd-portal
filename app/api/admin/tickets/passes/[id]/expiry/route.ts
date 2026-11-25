import { z } from 'zod'
import { adminAction, extendPass } from '@/lib/server/tickets/admin'

export const POST = adminAction(z.object({ expires_at: z.iso.datetime({ offset: true }) }), (deps, id, body) => extendPass(deps, id, body.expires_at))
