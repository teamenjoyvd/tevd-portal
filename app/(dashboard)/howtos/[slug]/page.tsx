import { redirect } from 'next/navigation'
// Deprecated — howtos renamed to guides (ISS-0144)
export default async function HowtoArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  redirect(`/guides/${slug}`)
}
