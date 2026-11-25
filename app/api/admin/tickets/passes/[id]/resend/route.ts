import { z } from 'zod'
import { adminAction, resendPass } from '@/lib/server/tickets/admin'

export const POST = adminAction(z.object({}), (deps, id) => resendPass(deps, id))
