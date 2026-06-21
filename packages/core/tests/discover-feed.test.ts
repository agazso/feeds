import { describe, expect, test } from 'vitest'
import { applyDiscoveredFeedDefaults } from '../src/discover-feed'
import type { Post } from '../src/models/post'
import type { RSSItem } from '../src/models/rss'

const FEED_URL = 'https://www.youtube.com/feeds/videos.xml?channel_id=UC123'

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    _id: 'p1',
    text: 'hi',
    createdAt: 0,
    images: [],
    link: 'https://www.youtube.com/watch?v=abc',
    ...overrides,
  } as Post
}

function makeItem(thumb?: string): RSSItem {
  return {
    title: 'A video',
    description: '',
    link: 'https://www.youtube.com/watch?v=abc',
    url: 'https://www.youtube.com/watch?v=abc',
    created: 0,
    media: thumb ? { thumbnail: [{ url: [thumb], width: [480], height: [360] }] } : undefined,
  }
}

describe('applyDiscoveredFeedDefaults', () => {
  // Posts that dropped to the fallback (YouTube rate-limited the page fetch) lack
  // feedUrl + image; backfill them from the feed and the RSS item's thumbnail.
  test('backfills missing feedUrl and thumbnail', () => {
    const thumb = 'https://i.ytimg.com/vi/abc/hqdefault.jpg'
    const post = applyDiscoveredFeedDefaults(makePost(), FEED_URL, makeItem(thumb))
    expect(post.feedUrl).toBe(FEED_URL)
    expect(post.images?.[0]?.uri).toBe(thumb)
  })

  test('leaves an already-complete post unchanged', () => {
    const post = applyDiscoveredFeedDefaults(
      makePost({ feedUrl: 'https://other/feed.xml', images: [{ uri: 'https://img/x.jpg' }] }),
      FEED_URL,
      makeItem('https://i.ytimg.com/vi/abc/hqdefault.jpg'),
    )
    expect(post.feedUrl).toBe('https://other/feed.xml')
    expect(post.images?.[0]?.uri).toBe('https://img/x.jpg')
  })
})
