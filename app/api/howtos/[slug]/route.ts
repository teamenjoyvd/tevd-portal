import { NextRequest, NextResponse } from 'next/server'
// Deprecated — redirects to /api/guides/[slug] (ISS-0144)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const url = new URL(req.url)
  url.pathname = `/api/guides/${slug}`
  return NextResponse.redirect(url, 308)
}
