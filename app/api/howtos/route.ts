import { NextRequest, NextResponse } from 'next/server'
// Deprecated — redirects to /api/guides (ISS-0144)
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  url.pathname = url.pathname.replace('/api/howtos', '/api/guides')
  return NextResponse.redirect(url, 308)
}
