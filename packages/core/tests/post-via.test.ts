import { describe, expect, test } from 'vitest'
import { enrichRssItems } from '../src/discover-feed'
import type { DiscoveredFeedInfo } from '../src/discover-feed'
import type { RSSItem } from '../src/models/rss'

const feed: DiscoveredFeedInfo = {
  name: 'Hacker News',
  url: 'https://news.ycombinator.com/',
  feedUrl: 'https://news.ycombinator.com/rss',
  favicon: 'https://news.ycombinator.com/y18.svg',
  itemCount: 0,
  enrich: true,
}

const item = (link: string): RSSItem => ({
  title: 'a title',
  description: '',
  link,
  url: link,
  created: 1_700_000_000_000,
})

// skipEnrichment keeps these offline: no page is fetched, so the attribution is decided
// purely by the item's link and the resulting author.
const build = (links: string[]) => enrichRssItems(links.map(item), feed, { skipEnrichment: true })

describe('post.via (link aggregator attribution)', () => {
  test('credits the aggregator for an item that came from another site', async () => {
    const [post] = await build(['https://elsewhere.example/article'])
    expect(post.via).toEqual({
      name: 'Hacker News',
      url: 'https://news.ycombinator.com/',
      icon: 'https://news.ycombinator.com/y18.svg',
    })
  })

  test('leaves a self-post alone — it is already attributed to the aggregator', async () => {
    const [post] = await build(['https://news.ycombinator.com/item?id=1'])
    expect(post.via).toBeUndefined()
  })

  test('is not set for a feed that links to itself', async () => {
    const blog: DiscoveredFeedInfo = { ...feed, name: 'A Blog', url: 'https://blog.example/', feedUrl: 'https://blog.example/feed.xml' }
    const posts = await enrichRssItems([item('https://blog.example/one')], blog, {
      skipEnrichment: true,
    })
    expect(posts[0].via).toBeUndefined()
  })

  test('omits the icon when the feed has none', async () => {
    const posts = await enrichRssItems([item('https://elsewhere.example/a')], { ...feed, favicon: '' }, {
      skipEnrichment: true,
    })
    expect(posts[0].via?.icon).toBeUndefined()
    expect(posts[0].via?.name).toBe('Hacker News')
  })
})
