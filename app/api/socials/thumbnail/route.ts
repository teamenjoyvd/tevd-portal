// Proxy route for social post thumbnails.
// Facebook/Instagram CDN blocks direct browser <img> requests (CORS + hotlink protection).
// Fetching server-side bypasses this — servers are not subject to CORS restrictions.

export const revalidate = 3600 // cache proxied images for 1 hour

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url)
  const src = searchParams.get('src')

  if (!src) {
    return new Response('Missing src', { status: 400 })
  }

  // Only proxy known social CDN hostnames — do not allow arbitrary URL proxying
  let hostname: string
  try {
    hostname = new URL(src).hostname
  } catch {
    return new Response('Invalid src', { status: 400 })
  }

  const ALLOWED_HOSTNAMES = [
    'scontent.fbcdn.net',
    'scontent-iad3-1.xx.fbcdn.net',
    'scontent-iad3-2.xx.fbcdn.net',
    'scontent-lga3-1.xx.fbcdn.net',
    'scontent-lga3-2.xx.fbcdn.net',
    'cdninstagram.com',
  ]

  // Allow any *.fbcdn.net or *.cdninstagram.com subdomain
  const isAllowed = ALLOWED_HOSTNAMES.includes(hostname)
    || hostname.endsWith('.fbcdn.net')
    || hostname.endsWith('.cdninstagram.com')

  if (!isAllowed) {
    return new Response('Disallowed host', { status: 403 })
  }

  try {
    const upstream = await fetch(src, {
      headers: {
        // Mimic a browser request so CDN doesn't reject with 403
        'User-Agent': 'Mozilla/5.0 (compatible; tevd-portal/1.0)',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!upstream.ok) {
      return new Response('Upstream error', { status: 502 })
    }

    const contentType = upstream.headers.get('content-type') ?? 'image/jpeg'
    const body = await upstream.arrayBuffer()

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    })
  } catch {
    return new Response('Fetch failed', { status: 502 })
  }
}
