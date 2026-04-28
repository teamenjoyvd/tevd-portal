import SharedGuidesClient, { type Props } from '@/components/guides/GuidesClient'

export default function GuidesClient(props: Omit<Props, 'guideHrefPrefix'>) {
  return <SharedGuidesClient {...props} guideHrefPrefix="/library" />
}
