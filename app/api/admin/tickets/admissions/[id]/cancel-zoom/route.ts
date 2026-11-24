import { z } from 'zod'
import { adminAction, retryZoomCancel } from '@/lib/server/tickets/admin'

export const POST = adminAction(z.object({}), (deps, id) => retryZoomCancel(deps, id))
