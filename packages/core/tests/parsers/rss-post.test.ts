import { afterEach, describe, expect, test, vi } from 'vitest'
import { augmentFeedWithMetadata } from '../../src/parsers/rss-post'
import type { RSSFeedWithMetrics } from '../../src/models/rss'

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
