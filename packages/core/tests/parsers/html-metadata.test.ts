import { describe, it, expect } from 'vitest'
import { parseHtmlMetaData, parseAllFeedLinksFromHtml } from '../../src/parsers/html-metadata'

describe('parseHtmlMetaData', () => {
  describe('pages without <head> tag', () => {
    const minimalHtml = `<!doctype html><html lang=en><meta name=viewport content="width=device-width,initial-scale=1"><title>Test Title</title><link rel=icon href=/favicon.png><link rel=alternate href=/feed.xml type=application/atom+xml title="Site Feed"><link rel=me href=https://mastodon.social/@user><header><nav>...</nav></header>`

    it('should extract title from pages without head tag', () => {
      const result = parseHtmlMetaData('https://example.com/page/', minimalHtml)
      expect(result.title).toBe('Test Title')
    })

    it('should extract favicon from pages without head tag', () => {
      const result = parseHtmlMetaData('https://example.com/page/', minimalHtml)
      expect(result.icon).toBe('https://example.com/favicon.png')
    })

    it('should extract siteName from RSS feed title on pages without head tag', () => {
      const result = parseHtmlMetaData('https://example.com/page/', minimalHtml)
      expect(result.siteName).toBe('Site Feed')
    })

    it('should extract author from link rel="me" on pages without head tag', () => {
      const result = parseHtmlMetaData('https://example.com/page/', minimalHtml)
      expect(result.author).toBe('user')
    })

    it('should extract feedLinks from pages without head tag', () => {
      const result = parseHtmlMetaData('https://example.com/page/', minimalHtml)
      expect(result.feedLinks).toHaveLength(1)
      expect(result.feedLinks[0]).toEqual({
        url: 'https://example.com/feed.xml',
        title: 'Site Feed',
        type: 'atom',
      })
    })
  })

  describe('pages with standard <head> tag', () => {
    const standardHtml = `<!DOCTYPE html><html><head><title>Standard Page</title><link rel="icon" href="/icon.png"><link rel="alternate" href="/rss.xml" type="application/rss+xml" title="My Blog"></head><body></body></html>`

    it('should extract metadata from standard HTML structure', () => {
      const result = parseHtmlMetaData('https://example.com/', standardHtml)
      expect(result.title).toBe('Standard Page')
      expect(result.icon).toBe('https://example.com/icon.png')
      expect(result.siteName).toBe('My Blog')
    })
  })

  describe('link rel="me" author extraction', () => {
    it('should extract username from Mastodon URL', () => {
      const html = `<!doctype html><html><head><link rel="me" href="https://hachyderm.io/@ifreund"></head><body></body></html>`
      const result = parseHtmlMetaData('https://example.com/', html)
      expect(result.author).toBe('ifreund')
    })

    it('should handle different Mastodon instances', () => {
      const html = `<!doctype html><html><head><link rel="me" href="https://fosstodon.org/@developer"></head><body></body></html>`
      const result = parseHtmlMetaData('https://example.com/', html)
      expect(result.author).toBe('developer')
    })

    it('should ignore non-Mastodon rel="me" links', () => {
      const html = `<!doctype html><html><head><link rel="me" href="https://github.com/username"></head><body></body></html>`
      const result = parseHtmlMetaData('https://example.com/', html)
      expect(result.author).toBe('')
    })
  })

  describe('real-world example: isaacfreund.com', () => {
    const isaacHtml = `<!doctype html><html lang=en><meta name=viewport content="width=device-width,initial-scale=1"><title>Separating the Wayland Compositor and Window Manager</title><link rel=icon href=/if.png><link rel=stylesheet href=/style.css><link rel=alternate href=/blog/feed.xml type=application/atom+xml title="Isaac Freund's Blog"><link rel=alternate href=/poetry/feed.xml type=application/atom+xml title="Isaac Freund's Poetry"><link rel=me href=https://hachyderm.io/@ifreund><header><nav>...</nav></header>`

    it('should extract title', () => {
      const result = parseHtmlMetaData('https://isaacfreund.com/blog/river-window-management/', isaacHtml)
      expect(result.title).toBe('Separating the Wayland Compositor and Window Manager')
    })

    it('should extract favicon', () => {
      const result = parseHtmlMetaData('https://isaacfreund.com/blog/river-window-management/', isaacHtml)
      expect(result.icon).toBe('https://isaacfreund.com/if.png')
    })

    it('should extract author from Mastodon link', () => {
      const result = parseHtmlMetaData('https://isaacfreund.com/blog/river-window-management/', isaacHtml)
      expect(result.author).toBe('ifreund')
    })

    it('should extract siteName from first RSS feed', () => {
      const result = parseHtmlMetaData('https://isaacfreund.com/blog/river-window-management/', isaacHtml)
      expect(result.siteName).toBe("Isaac Freund's Blog")
    })

    it('should extract all feed links', () => {
      const result = parseHtmlMetaData('https://isaacfreund.com/blog/river-window-management/', isaacHtml)
      expect(result.feedLinks).toHaveLength(2)
      expect(result.feedLinks[0]).toEqual({
        url: 'https://isaacfreund.com/blog/feed.xml',
        title: "Isaac Freund's Blog",
        type: 'atom',
      })
      expect(result.feedLinks[1]).toEqual({
        url: 'https://isaacfreund.com/poetry/feed.xml',
        title: "Isaac Freund's Poetry",
        type: 'atom',
      })
    })
  })
})

describe('parseAllFeedLinksFromHtml', () => {
  it('should extract multiple feed links', () => {
    const html = `<!doctype html><html><head>
      <link rel="alternate" href="/blog/feed.xml" type="application/atom+xml" title="Blog Feed">
      <link rel="alternate" href="/poetry/feed.xml" type="application/atom+xml" title="Poetry Feed">
    </head><body></body></html>`

    const result = parseAllFeedLinksFromHtml(html, 'https://example.com')
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ url: 'https://example.com/blog/feed.xml', title: 'Blog Feed', type: 'atom' })
    expect(result[1]).toEqual({ url: 'https://example.com/poetry/feed.xml', title: 'Poetry Feed', type: 'atom' })
  })

  it('should detect RSS feed type', () => {
    const html = `<!doctype html><html><head>
      <link rel="alternate" href="/feed.rss" type="application/rss+xml" title="RSS">
    </head><body></body></html>`

    const result = parseAllFeedLinksFromHtml(html, 'https://example.com')
    expect(result[0].type).toBe('rss')
  })

  it('should detect JSON feed type', () => {
    const html = `<!doctype html><html><head>
      <link rel="alternate" href="/feed.json" type="application/feed+json" title="JSON Feed">
    </head><body></body></html>`

    const result = parseAllFeedLinksFromHtml(html, 'https://example.com')
    expect(result[0].type).toBe('json')
  })

  it('should extract feeds from pages without head tag', () => {
    const html = `<!doctype html><html lang=en><link rel=alternate href=/feed.xml type=application/atom+xml title="Feed"><header>...</header>`

    const result = parseAllFeedLinksFromHtml(html, 'https://example.com')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      url: 'https://example.com/feed.xml',
      title: 'Feed',
      type: 'atom',
    })
  })
})

describe('parseHtmlMetaData YouTube watch pages', () => {
  // The watch page has no RSS <link> and reports "YouTube" as site, but embeds the
  // owner channel name + id. We derive author + channel feed from it so no extra
  // requests to YouTube are needed (avoids rate-limiting that breaks shares).
  const watchHtml = `<!doctype html><html><head>
    <meta property="og:title" content="3O YEARS OF QUAKE - YouTube">
    <meta property="og:image" content="https://i.ytimg.com/vi/abc/maxresdefault.jpg">
    <meta property="og:site_name" content="YouTube">
    </head><body>
    <script>var x = {"ownerChannelName":"Ruby Ranger","externalChannelId":"UCVXcgpFiYgnJov5QGqS105A"};</script>
    </body></html>`

  it('derives the channel feed URL from externalChannelId', () => {
    const result = parseHtmlMetaData('https://www.youtube.com/watch?v=abc', watchHtml)
    expect(result.feedUrl).toBe(
      'https://www.youtube.com/feeds/videos.xml?channel_id=UCVXcgpFiYgnJov5QGqS105A',
    )
  })

  it('uses the owner channel name (not "YouTube") as the name', () => {
    const result = parseHtmlMetaData('https://www.youtube.com/watch?v=abc', watchHtml)
    expect(result.name).toBe('Ruby Ranger')
  })
})

describe('feed-link titles naming the format', () => {
  const page = (title: string) =>
    parseHtmlMetaData(
      'https://example.com/post/',
      `<!doctype html><html><head><link rel="alternate" type="application/atom+xml" href="/feed" title="${title}"></head><body></body></html>`,
    ).siteName

  it('drops a format suffix introduced by a separator or bracket', () => {
    expect(page('Indie Retro News - Atom')).toBe('Indie Retro News')
    expect(page('Indie Retro News - RSS')).toBe('Indie Retro News')
    expect(page('Some Blog » RSS Feed')).toBe('Some Blog')
    expect(page('Some Blog (Feed)')).toBe('Some Blog')
  })

  it('leaves a site name that merely contains a format word', () => {
    expect(page('Atom Bomb News')).toBe('Atom Bomb News')
    expect(page("Isaac Freund's Blog")).toBe("Isaac Freund's Blog")
    expect(page('JSON - The Magazine')).toBe('JSON - The Magazine')
  })

  it('still rejects a title that is only the format', () => {
    expect(page('Atom')).toBe('')
    expect(page('RSS Feed')).toBe('')
  })
})
