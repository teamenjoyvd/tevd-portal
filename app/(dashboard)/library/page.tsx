import { getRoleForAccess, listGuidesForRole, listLinksForRole, listNewsForRole } from '@/lib/server/guides'
import type { Guide, SiteLink, NewsItem } from '@/lib/server/guides'
import GuidesClient from './GuidesClient'

export default async function LibraryPage() {
  const role = await getRoleForAccess()
  const [guides, links, news] = await Promise.all([
    listGuidesForRole({ role }),
    listLinksForRole({ role }),
    listNewsForRole({ role }),
  ])

  return (
    <GuidesClient
      initialGuides={guides}
      initialLinks={links}
      initialNews={news}
      initialDataUpdatedAt={Date.now()}
    />
  )
}
