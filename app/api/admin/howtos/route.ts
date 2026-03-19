import { NextRequest, NextResponse } from 'next/server'
// Deprecated — redirects to /api/admin/guides (ISS-0144)
function redirect(req: NextRequest) {
  const url = new URL(req.url)
  url.pathname = url.pathname.replace('/api/admin/howtos', '/api/admin/guides')
  return NextResponse.redirect(url, 308)
}
export const GET  = redirect
export const POST = redirect
