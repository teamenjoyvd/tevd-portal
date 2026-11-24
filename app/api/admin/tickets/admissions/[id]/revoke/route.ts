import { z } from 'zod'
import { adminAction, revokeAdmission } from '@/lib/server/tickets/admin'

export const POST = adminAction(z.object({}), (deps, id) => revokeAdmission(deps, id))
