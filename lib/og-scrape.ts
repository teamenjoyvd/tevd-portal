// server-only — do not import from client components
import 'server-only'

export type OgScrapeResult = {
  thumbnail_url: string | null
  caption: string | null
}

export async function scrapeOgTags(url: string): Promise<OgScrapeResult> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; tevd-portal/1.0)' },
    })
    clearTimeout(timeout)

    if (!res.ok) {
      console.error(`[og-scrape] HTTP ${res.status} for ${url}`)
      return { thumbnail_url: null, caption: null }
    }

    const html = await res.text()

    const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)

    const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i)

    return {
      thumbnail_url: ogImage?.[1] ?? null,
      caption: ogDesc?.[1] ?? null,
    }
  } catch (err) {
    console.error('[og-scrape] Failed to scrape', url, err)
    return { thumbnail_url: null, caption: null }
  }
}
