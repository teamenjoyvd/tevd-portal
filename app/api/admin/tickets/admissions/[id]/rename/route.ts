import { z } from 'zod'
import { adminAction, renameAdmission } from '@/lib/server/tickets/admin'

export const POST = adminAction(z.object({ name: z.string().trim().min(2).max(200) }), (deps, id, { name }) => renameAdmission(deps, id, name))
