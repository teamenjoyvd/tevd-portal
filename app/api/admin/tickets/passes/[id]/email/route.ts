import { z } from 'zod'
import { adminAction, correctPassEmail } from '@/lib/server/tickets/admin'

export const POST = adminAction(z.object({ email: z.email().max(320) }), (deps, id, { email }) => correctPassEmail(deps, id, email))
