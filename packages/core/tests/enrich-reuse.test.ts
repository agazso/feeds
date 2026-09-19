import { describe, expect, test } from 'vitest'
import { enrichRssItems } from '../src/discover-feed'
import type { DiscoveredFeedInfo } from '../src/discover-feed'
import type { Post } from '../src/models/post'
import type { RSSItem } from '../src/models/rss'

const feed: DiscoveredFeedInfo = {
  name: 'Hacker News',
  url: 'https://news.ycombinator.com/',
  feedUrl: 'https://news.ycombinator.com/rss',
  favicon: 'https://news.ycombinator.com/y18.svg',
  itemCount: 0,
  enrich: true,
}

const item: RSSItem = {
  title: 'a title',
  description: '',
  link: 'https://elsewhere.example/article',
  url: 'https://elsewhere.example/article',
  created: 1_700_000_000_000,
}

const cached = (iconUri: string): Post => ({
  _id: 'cached',
  text: 'cached body',
  createdAt: 1,
  images: [],
  link: item.link,
  author: { name: 'Elsewhere', uri: feed.url, image: { uri: iconUri } },
})

// skipEnrichment keeps this offline — rebuilding an item fetches nothing, so the only
// thing under test is whether the cached post was handed back or thrown away.
describe('enrichRssItems reuse', () => {
  test('reuses a well-enriched cached post verbatim', async () => {
    const previous = cached('https://elsewhere.example/favicon.ico')
    const [post] = await enrichRssItems([item], feed, { skipEnrichment: true, reuse: [previous] })
    expect(post).toBe(previous)
  })

  test('rebuilds a post left wearing the feed icon, so a bad window heals', async () => {
    const previous = cached(feed.favicon)
    const [post] = await enrichRssItems([item], feed, { skipEnrichment: true, reuse: [previous] })
    expect(post).not.toBe(previous)
    expect(post.text).not.toBe('cached body')
  })

  test('a feed with no icon of its own still reuses its posts', async () => {
    const noIcon = { ...feed, favicon: '' }
    const previous = cached('')
    const [post] = await enrichRssItems([item], noIcon, { skipEnrichment: true, reuse: [previous] })
    expect(post).toBe(previous)
  })
})
