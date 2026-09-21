import { afterEach, describe, expect, test, vi } from 'vitest'
import type { RSSFeedWithMetrics } from '../../src/models/rss'
import { augmentFeedWithMetadata, fetchContentWithMimeType } from '../../src/parsers/rss-post'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('augmentFeedWithMetadata', () => {
  // Regression: a successfully parsed feed must not be discarded just because the
  // secondary website fetch (for favicon/title) fails. Previously returned null,
  // which made YouTube channel-feed discovery error with "No RSS feed found".
  test('keeps the parsed feed when the website augmentation fetch fails', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('offline')
    })

    const feedUrl = 'https://www.youtube.com/feeds/videos.xml?channel_id=UC123'
    const rssFeed: RSSFeedWithMetrics = {
      feed: {
        title: 'Ruby Ranger',
        description: '',
        url: 'http://www.youtube.com/feeds/videos.xml?channel_id=UC123',
        items: [],
      },
      url: '',
      size: 0,
      downloadTime: 0,
      xmlTime: 0,
      parseTime: 0,
    }

    const feed = await augmentFeedWithMetadata(feedUrl, '', rssFeed)

    expect(feed).not.toBeNull()
    expect(feed?.name).toBe('Ruby Ranger')
    expect(feed?.feedUrl).toBe(feedUrl)
    // Default favicon resolves against the origin, not the deep feed path
    expect(feed?.favicon).toBe('https://www.youtube.com/favicon.ico')
  })
})

describe('rate limits during discovery', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // ARCHITECTURE §5: augmentFeedWithMetadata is best-effort. The feed already parsed,
  // so a throttled site page must not discard it — even though a rate limit is
  // otherwise allowed to propagate.
  test('a parsed feed survives its site page being throttled', async () => {
    vi.stubGlobal('fetch', async () => new Response('<html>slow down</html>', { status: 429 }))

    const feed = await augmentFeedWithMetadata('https://example.com/feed.xml', '', {
      feed: { title: 'Steady Feed', description: '', url: 'https://example.com/', items: [] },
      url: 'https://example.com/feed.xml',
      size: 0,
      downloadTime: 0,
      xmlTime: 0,
      parseTime: 0,
    })

    expect(feed).not.toBeNull()
    expect(feed?.name).toBe('Steady Feed')
  })

  // The opposite case: nothing has been salvaged yet, so the caller needs to hear it.
  test('fetchContentWithMimeType lets a rate limit through', async () => {
    vi.stubGlobal('fetch', async () => new Response('slow down', { status: 429 }))

    await expect(fetchContentWithMimeType('https://example.com/')).rejects.toThrow(/rate limiting/i)
  })

  test('other failures stay a plain miss', async () => {
    vi.stubGlobal('fetch', async () => new Response('gone', { status: 500 }))

    expect(await fetchContentWithMimeType('https://example.com/')).toBeNull()
  })
})
