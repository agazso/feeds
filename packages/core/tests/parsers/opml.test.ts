import { describe, expect, test } from 'vitest'
import type { Feed } from '../../src/models/feed'
import { buildOPML, parseOPML, readOPML } from '../../src/parsers/opml'

const DATE = new Date(Date.UTC(2026, 0, 2, 3, 4, 5))

function makeFeed(over: Partial<Feed> = {}): Feed {
  return {
    name: 'Example Blog',
    url: 'https://example.com/',
    feedUrl: 'https://example.com/feed.xml',
    favicon: '',
    ...over,
  }
}

describe('buildOPML', () => {
  test('writes an outline per feed', async () => {
    const xml = buildOPML([makeFeed()], 'Feeds', DATE)
    expect(xml).toContain('<opml version="2.0">')
    expect(xml).toContain('<title>Feeds</title>')
    expect(xml).toContain('<dateCreated>Fri, 02 Jan 2026 03:04:05 GMT</dateCreated>')
    expect(xml).toContain('xmlUrl="https://example.com/feed.xml"')
    expect(xml).toContain('htmlUrl="https://example.com/"')
    expect(xml).toContain('title="Example Blog"')
    // The spec requires `text`; readers that ignore `title` still show something.
    expect(xml).toContain('text="Example Blog"')
  })

  test('carries tags as categories so a filtered export keeps them', () => {
    const xml = buildOPML([makeFeed({ tags: ['music', 'guitar'] })], 'Feeds', DATE)
    expect(xml).toContain('category="music,guitar"')
  })

  test('omits htmlUrl and category when there is nothing to write', () => {
    const xml = buildOPML([makeFeed({ url: '', tags: [] })], 'Feeds', DATE)
    expect(xml).not.toContain('htmlUrl=')
    expect(xml).not.toContain('category=')
  })

  test('escapes a name that would otherwise break the attribute', () => {
    const xml = buildOPML([makeFeed({ name: 'Tom & "Jerry" <news>' })], 'Feeds', DATE)
    expect(xml).toContain('title="Tom &amp; &quot;Jerry&quot; &lt;news&gt;"')
    expect(xml).not.toContain('<news>')
  })

  test('falls back to the feed url when a feed has no name', () => {
    const xml = buildOPML([makeFeed({ name: '' })], 'Feeds', DATE)
    expect(xml).toContain('text="https://example.com/feed.xml"')
  })

  test('writes a valid document for no feeds at all', async () => {
    const xml = buildOPML([], 'Feeds', DATE)
    expect(xml).toContain('<body>')
    expect(await readOPML(xml)).toEqual([])
  })

  // The point of the format: what we write, a reader (and our own parser) reads back.
  test('round-trips through parseOPML', async () => {
    const feeds = [
      makeFeed(),
      makeFeed({
        name: 'Indie Retro News',
        url: 'https://www.indieretronews.com/',
        feedUrl: 'https://www.indieretronews.com/feeds/posts/default',
        tags: ['games'],
      }),
    ]
    const parsed = await parseOPML(buildOPML(feeds, 'Feeds', DATE))
    expect(parsed).toBeDefined()
    expect(parsed?.map((f) => ({ name: f.name, url: f.url, feedUrl: f.feedUrl }))).toEqual(
      feeds.map((f) => ({ name: f.name, url: f.url, feedUrl: f.feedUrl })),
    )
  })
})
