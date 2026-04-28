import { adminCore } from './core'
import { adminOperations } from './operations'
import { adminContent } from './content'

// Dev-time guard: catch any intra-admin duplicate keys before the spread merge
// silently overwrites them (the top-level assertNoDuplicateKeys in lib/i18n/index.ts
// only sees the already-merged admin object and cannot detect cross-sub-domain dupes).
if (process.env.NODE_ENV !== 'production') {
  const seen = new Set<string>()
  const dupes: string[] = []
  for (const domain of [adminCore, adminOperations, adminContent]) {
    for (const key of Object.keys(domain)) {
      if (seen.has(key)) dupes.push(key)
      else seen.add(key)
    }
  }
  if (dupes.length > 0) {
    throw new Error(
      `[i18n/admin] Duplicate keys across admin sub-domains:\n  ${dupes.join('\n  ')}`,
    )
  }
}

export const admin = {
  ...adminCore,
  ...adminOperations,
  ...adminContent,
} as const
