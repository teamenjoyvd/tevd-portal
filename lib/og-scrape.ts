import 'server-only'

export async function scrapeOG(
  url: string
): Promise<{ thumbnail_url: string | null; caption: string | null }> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    clearTimeout(timeout)
    if (!res.ok) return { thumbnail_url: null, caption: null }
    const html = await res.text()
    const ogImage =
      html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1] ??
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)?.[1] ??
      null
    const ogDesc =
      html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)?.[1] ??
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i)?.[1] ??
      null
    return { thumbnail_url: ogImage ?? null, caption: ogDesc ?? null }
  } catch (err) {
    console.error('[og-scrape] failed for', url, err)
    return { thumbnail_url: null, caption: null }
  }
}
