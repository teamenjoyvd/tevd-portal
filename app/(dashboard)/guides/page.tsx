import { getRoleForAccess, listGuidesForRole, listLinksForRole } from '@/lib/server/guides'
import type { Guide, SiteLink } from '@/lib/server/guides'
import GuidesClient from './GuidesClient'

export default async function GuidesPage() {
  // Parallel server fetch — role resolved once, both queries run concurrently.
  const role = await getRoleForAccess()
  const [guides, links] = await Promise.all([
    listGuidesForRole({ role }),
    listLinksForRole({ role }),
  ])

  return (
    <GuidesClient
      initialGuides={guides}
      initialLinks={links}
      initialDataUpdatedAt={0}
    />
  )
}
