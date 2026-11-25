import { z } from 'zod'
import { adminAction, reissuePass } from '@/lib/server/tickets/admin'

export const POST = adminAction(z.object({}), (deps, id) => reissuePass(deps, id))
