// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import SocialsTile from './SocialsTile'

/**
 * /api/socials returns exactly ONE post, so the tile is judged alone against
 * whatever that post happens to be. These cases are the data shapes seeded into
 * DEV for the #743 design review, kept here so a refactor cannot quietly drop one.
 *
 * First component test suite in this repo — `vitest.config.ts` runs it under jsdom
 * via the docblock above; every other suite stays on the node environment.
 */

// Real copy, not stubs: a missing translation key fails the assertion rather than
// silently rendering the key name.
vi.mock('@/lib/hooks/useLanguage', async () => {
  const { translations } = await import('@/lib/i18n')
  return {
    useLanguage: () => ({
      lang: 'en' as const,
      toggle: () => {},
      t: (key: keyof typeof translations) => translations[key].en,
    }),
  }
})

const useQueryMock = vi.hoisted(() => vi.fn())
vi.mock('@tanstack/react-query', () => ({ useQuery: useQueryMock }))

type Post = {
  id: string
  platform: string
  post_url: string
  caption: string | null
  thumbnail_url: string | null
  is_pinned: boolean
  created_at: string
  posted_at: string | null
}

const BASE: Post = {
  id: 'p1',
  platform: 'instagram',
  post_url: 'https://www.instagram.com/p/abc123/',
  caption: 'A weekend in Bansko with the whole team.',
  thumbnail_url: 'https://example.supabase.co/storage/v1/object/public/social-thumbnails/x.jpg',
  is_pinned: true,
  created_at: '2026-08-13T09:00:00.000Z',
  posted_at: '2026-08-13T09:00:00.000Z',
}

function renderTile(post: Post | null, { isLoading = false }: { isLoading?: boolean } = {}) {
  useQueryMock.mockReturnValue({ data: { post }, isLoading })
  const { container } = render(<SocialsTile />)
  const card = container.firstElementChild as HTMLElement
  return { container, card }
}

afterEach(() => {
  cleanup()
  useQueryMock.mockReset()
})

describe('SocialsTile — the six seeded data shapes', () => {
  it('renders a long caption as a full-bleed hero clamped to 2 lines', () => {
    const { card } = renderTile({ ...BASE, caption: 'Невероятен уикенд в Банско с целия отбор! '.repeat(6) })

    expect(card.className).toContain('p-0')
    expect(card.className).toContain('overflow-hidden')
    const caption = card.querySelector('p') as HTMLElement
    expect(caption.style.webkitLineClamp).toBe('2')
    expect(caption.style.overflow).toBe('hidden')
  })

  it('keeps a short caption in the same hero treatment', () => {
    const { card } = renderTile({ ...BASE, platform: 'facebook', caption: 'New season, new goals.' })

    expect(screen.getByText('New season, new goals.')).toBeDefined()
    expect(card.querySelector('img')).not.toBeNull()
  })

  it('falls back to the view-post line when the post has no caption', () => {
    renderTile({ ...BASE, caption: null })

    expect(screen.getByText('View post →')).toBeDefined()
  })

  it('drops the scrim and fills the card when the post has no thumbnail', () => {
    const { card } = renderTile({ ...BASE, thumbnail_url: null })

    expect(card.className).toContain('card--forest')
    expect(card.querySelector('img')).toBeNull()
    // A scrim over no image is the broken-looking state this avoids.
    expect(card.querySelector('[aria-hidden="true"]')).toBeNull()
  })

  it('treats an empty-string thumbnail as absent, not as a src', () => {
    const { card } = renderTile({ ...BASE, thumbnail_url: '' })

    expect(card.querySelector('img')).toBeNull()
    expect(card.className).toContain('card--forest')
  })

  it('omits the profile pill for a platform with no known profile URL', () => {
    const { card } = renderTile({ ...BASE, platform: 'tiktok' })

    const links = card.querySelectorAll('a')
    expect(links).toHaveLength(1)
    expect(links[0].getAttribute('href')).toBe(BASE.post_url)
  })
})

describe('SocialsTile — link structure', () => {
  it('links the whole card to the post and the pill to the profile, as siblings', () => {
    const { card } = renderTile(BASE)

    const links = Array.from(card.querySelectorAll('a'))
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      BASE.post_url,
      'https://www.instagram.com/teamenjoyvd/',
    ])
    // An <a> inside an <a> is invalid HTML — the pill is a sibling overlay.
    expect(card.querySelector('a a')).toBeNull()
    for (const a of links) {
      expect(a.getAttribute('target')).toBe('_blank')
      expect(a.getAttribute('rel')).toBe('noopener noreferrer')
    }
  })

  it('gives the card-wide link an accessible name, since it wraps no text', () => {
    const { card } = renderTile(BASE)

    const overlay = card.querySelector('a') as HTMLAnchorElement
    expect(overlay.textContent).toBe('')
    expect(overlay.getAttribute('aria-label')).toBe('Open post')
  })

  it('resolves the facebook profile for a facebook post', () => {
    const { card } = renderTile({ ...BASE, platform: 'facebook' })

    const links = Array.from(card.querySelectorAll('a'))
    expect(links[1].getAttribute('href')).toBe('https://www.facebook.com/teamenjoyvd/')
  })
})

describe('SocialsTile — thumbnail proxying', () => {
  it('uses a Storage URL directly', () => {
    const { card } = renderTile(BASE)

    expect(card.querySelector('img')?.getAttribute('src')).toBe(BASE.thumbnail_url)
  })

  it('routes a hotlink-blocked CDN URL through the proxy', () => {
    const cdn = 'https://scontent.fbcdn.net/v/t51/photo.jpg'
    const { card } = renderTile({ ...BASE, thumbnail_url: cdn })

    expect(card.querySelector('img')?.getAttribute('src')).toBe(
      `/api/socials/thumbnail?src=${encodeURIComponent(cdn)}`,
    )
  })
})

describe('SocialsTile — non-post states keep the padded card', () => {
  it('shows the coming-soon copy when there is no post', () => {
    const { card } = renderTile(null)

    expect(screen.getByText('Social feed coming soon.')).toBeDefined()
    expect(card.className).not.toContain('p-0')
    expect(card.className).toContain('flex-col')
  })

  it('shows a skeleton while loading', () => {
    const { card } = renderTile(null, { isLoading: true })

    expect(card.querySelector('.animate-pulse')).not.toBeNull()
    expect(card.className).not.toContain('p-0')
  })
})
