import { cookies } from 'next/headers'
import { getRoleForAccess, listGuidesForRole, listLinksForRole, listNewsForRole } from '@/lib/server/guides'
import type { Guide, SiteLink, NewsItem } from '@/lib/server/guides'
import GuidesClient from './GuidesClient'

export default async function LibraryPage() {
  const role = await getRoleForAccess()
  const cookieStore = await cookies()
  // Restore the last-selected category (zero-flash SSR); GuidesClient validates the value.
  const initialTab = cookieStore.get('tevd_library_tab')?.value ?? 'all'
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
      guideHrefPrefix="/library"
      initialTab={initialTab}
    />
  )
}
