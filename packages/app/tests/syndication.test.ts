import type { Post } from '@feeds/core'
import { describe, expect, test } from 'vitest'
import { feedPageUrl } from '../src/lib/server/syndicate-feed'
import { feedUrls, isSyndicationFormat, syndicate } from '../src/lib/server/syndication'

const META = { title: 'Feeds', link: 'https://x.test/myfeed', self: 'https://x.test/myfeed.rss' }

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    _id: '1',
    text: '**A title**\n\nbody',
    images: [],
    createdAt: Date.UTC(2026, 0, 2, 3, 4, 5),
    link: 'https://example.com/a',
    ...overrides,
  }
}

async function body(format: 'rss' | 'json', posts: Post[]) {
  return await syndicate(format, posts, META).text()
}

describe('syndicate', () => {
  test('splits title and body the way the cards do', async () => {
    const rss = await body('rss', [makePost()])
    expect(rss).toContain('<title>A title</title>')
    expect(rss).toContain('<description>body</description>')

    const feed = JSON.parse(await body('json', [makePost()]))
    expect(feed.items[0].title).toBe('A title')
    expect(feed.items[0].content_text).toBe('body')
  })

  test('escapes markup so a post cannot break the document', async () => {
    const post = makePost({ text: '**Tom & </rss>**\n\n<script>x</script>' })
    const rss = await body('rss', [post])
    expect(rss).toContain('<title>Tom &amp; &lt;/rss&gt;</title>')
    expect(rss).not.toContain('<script>')
    // Still a well-formed document: exactly the tags we emitted.
    expect(rss.match(/<\/rss>/g)).toHaveLength(1)
  })

  test('escapes an ampersand in an image url', async () => {
    const post = makePost({ images: [{ uri: 'https://i.test/a.jpg?w=1&h=2' }] })
    expect(await body('rss', [post])).toContain('url="https://i.test/a.jpg?w=1&amp;h=2"')
  })

  test('carries tags, author and date', async () => {
    const post = makePost({
      tags: ['music'],
      author: { name: 'Ann', uri: 'https://ann.test', image: { uri: '' } },
    })
    const rss = await body('rss', [post])
    expect(rss).toContain('<category>music</category>')
    expect(rss).toContain('<dc:creator>Ann</dc:creator>')
    expect(rss).toContain('<pubDate>Fri, 02 Jan 2026 03:04:05 GMT</pubDate>')

    const feed = JSON.parse(await body('json', [post]))
    expect(feed.items[0].tags).toEqual(['music'])
    expect(feed.items[0].authors).toEqual([{ name: 'Ann', url: 'https://ann.test' }])
    expect(feed.items[0].date_published).toBe('2026-01-02T03:04:05.000Z')
  })

  // Enrichment replaces the author with the linked site's, so an aggregator item
  // would otherwise carry nothing pointing back at the discussion it came from.
  test('keeps the aggregator link of an enriched post', async () => {
    const post = makePost({
      link: 'https://blog.test/article',
      via: { name: 'Hacker News', url: 'https://news.ycombinator.com/item?id=1' },
    })
    expect(await body('rss', [post])).toContain(
      '<comments>https://news.ycombinator.com/item?id=1</comments>',
    )
    const item = JSON.parse(await body('json', [post])).items[0]
    expect(item.url).toBe('https://blog.test/article')
    expect(item.external_url).toBe('https://news.ycombinator.com/item?id=1')
  })

  test('omits the aggregator link when there is none', async () => {
    expect(await body('rss', [makePost()])).not.toContain('<comments>')
    expect(JSON.parse(await body('json', [makePost()])).items[0]).not.toHaveProperty('external_url')
  })

  test('serves an empty feed rather than failing', async () => {
    expect(await body('rss', [])).toContain('<title>Feeds</title>')
    expect(JSON.parse(await body('json', [])).items).toEqual([])
  })

  test('sets the content type per format', () => {
    expect(syndicate('rss', [], META).headers.get('content-type')).toBe(
      'application/rss+xml; charset=utf-8',
    )
    expect(syndicate('json', [], META).headers.get('content-type')).toBe(
      'application/feed+json; charset=utf-8',
    )
  })
})

describe('route helpers', () => {
  test('only rss and json are feed formats', () => {
    expect(isSyndicationFormat('rss')).toBe(true)
    expect(isSyndicationFormat('json')).toBe(true)
    expect(isSyndicationFormat('xml')).toBe(false)
  })

  test('the home page url drops the extension, keeping the user scope', () => {
    expect(feedUrls(new URL('https://x.test/@bob/tags/music.rss'), 'rss')).toEqual({
      link: 'https://x.test/@bob/tags/music',
      self: 'https://x.test/@bob/tags/music.rss',
    })
  })

  // A feed page puts the format ahead of the URL, which is full of dots and may
  // itself end in `.rss` — so the extension form cannot be used there.
  test('a feed page url maps back to its page, user scope intact', () => {
    const reddit = 'https%3A%2F%2Freddit.com%2Fr%2FFire.rss'
    expect(feedPageUrl(new URL(`https://x.test/feeds.rss/${reddit}`), 'rss')).toBe(
      `https://x.test/feeds/${reddit}`,
    )
    expect(feedPageUrl(new URL(`https://x.test/@bob/feeds.json/${reddit}`), 'json')).toBe(
      `https://x.test/@bob/feeds/${reddit}`,
    )
  })
})
