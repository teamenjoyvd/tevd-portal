import { adminCore } from './core'
import { adminOperations } from './operations'
import { adminContent } from './content'

export const admin = {
  ...adminCore,
  ...adminOperations,
  ...adminContent,
} as const
