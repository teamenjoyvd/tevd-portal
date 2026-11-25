import { z } from 'zod'
import { adminAction, retryAdmission } from '@/lib/server/tickets/admin'

export const POST = adminAction(z.object({}), (deps, id) => retryAdmission(deps, id))
