import { afterEach, describe, expect, test, vi } from 'vitest'
import { fetchYoutubeFeed } from '../../src/providers/youtube'

const ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <link rel="self" href="https://www.youtube.com/feeds/videos.xml?channel_id=UC123"/>
  <link rel="alternate" href="https://www.youtube.com/channel/UC123"/>
  <title>Ruby Ranger</title>
  <entry>
    <title>A video</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=abc"/>
  </entry>
</feed>`

// Stub fetch: the feed (videos.xml) request returns the atom XML; the channel page
// (/channel/<id>) request returns HTML. `channelHtml` controls whether the @handle
// is resolvable.
function stubFetch(calls: string[], channelHtml: string) {
  vi.stubGlobal('fetch', async (input: string | URL) => {
    const url = String(input)
    calls.push(url)
    if (url.includes('/channel/')) {
      return new Response(channelHtml, { status: 200, headers: { 'Content-Type': 'text/html' } })
    }
    return new Response(ATOM, { status: 200, headers: { 'Content-Type': 'text/xml' } })
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchYoutubeFeed', () => {
  const url = 'https://www.youtube.com/feeds/videos.xml?channel_id=UC123'

  // Regression: a direct channel RSS feed URL must be fetched as-is. Previously the
  // URL was canonicalized, which stripped the required channel_id query and made
  // the request fetch the wrong (id-less) URL, returning no feed.
  test('fetches a direct channel feed URL without stripping channel_id', async () => {
    const calls: string[] = []
    stubFetch(calls, '<html><head></head></html>')

    const result = await fetchYoutubeFeed(url)
    const feed = Array.isArray(result) ? result[0] : result

    expect(feed?.feedUrl).toBe(url)
    // The very first request must preserve the query (pre-fix it was id-less)
    expect(calls[0]).toContain('channel_id=UC123')
  })

  // Regression: the displayed feed.url must be the channel page (the @handle), not
  // the videos.xml self-link that augmentFeedWithMetadata would otherwise set.
  test('sets feed.url to the channel @handle page', async () => {
    const calls: string[] = []
    stubFetch(calls, '<html><body>"canonicalBaseUrl":"/@RubyRangerr"</body></html>')

    const result = await fetchYoutubeFeed(url)
    const feed = Array.isArray(result) ? result[0] : result

    expect(feed?.feedUrl).toBe(url) // feed key unchanged
    expect(feed?.url).toBe('https://www.youtube.com/@RubyRangerr')
  })

  test('falls back to /channel/<id> when the @handle is unavailable', async () => {
    const calls: string[] = []
    stubFetch(calls, '<html><head></head></html>') // no canonicalBaseUrl

    const result = await fetchYoutubeFeed(url)
    const feed = Array.isArray(result) ? result[0] : result

    expect(feed?.url).toBe('https://www.youtube.com/channel/UC123')
  })
})

// A YouTube page embeds its channel id in the player JSON; that is the only place a
// /watch URL reveals which channel it belongs to.
const PAGE_HTML = (channelId: string) =>
  `<html><head><title>A video - YouTube</title></head><body>
   {"ownerChannelName":"Ruby Ranger","externalChannelId":"${channelId}"}</body></html>`

/** Page requests return HTML, feed requests return the atom XML. */
function stubPageAndFeed(calls: string[], channelId = 'UC123') {
  vi.stubGlobal('fetch', async (input: string | URL) => {
    const url = String(input)
    calls.push(url)
    if (url.includes('/feeds/videos.xml')) {
      return new Response(ATOM, { status: 200, headers: { 'Content-Type': 'text/xml' } })
    }
    return new Response(PAGE_HTML(channelId), {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    })
  })
}

describe('fetchYoutubeFeed for pages that are not a feed URL', () => {
  // Regression: getCanonicalUrl strips the query, so a watch URL became
  // youtube.com/watch — a page with no feed — and discovery reported none at all.
  test('resolves a /watch URL to its channel feed', async () => {
    const calls: string[] = []
    stubPageAndFeed(calls)

    const result = await fetchYoutubeFeed('https://www.youtube.com/watch?v=abc123')
    const feed = Array.isArray(result) ? result[0] : result

    expect(feed?.feedUrl).toBe('https://www.youtube.com/feeds/videos.xml?channel_id=UC123')
    // The ?v= must survive to the page request, or the wrong page is fetched.
    expect(calls[0]).toContain('v=abc123')
  })

  test('keeps the video id when the URL carries other query parameters', async () => {
    const calls: string[] = []
    stubPageAndFeed(calls)

    await fetchYoutubeFeed('https://www.youtube.com/watch?v=abc123&t=42s')
    expect(calls[0]).toContain('v=abc123')
  })

  test('resolves a /shorts URL', async () => {
    const calls: string[] = []
    stubPageAndFeed(calls)

    const result = await fetchYoutubeFeed('https://www.youtube.com/shorts/abc123')
    const feed = Array.isArray(result) ? result[0] : result

    expect(feed?.feedUrl).toBe('https://www.youtube.com/feeds/videos.xml?channel_id=UC123')
  })

  test('a channel page is its own link, and costs no extra request to find out', async () => {
    const calls: string[] = []
    stubPageAndFeed(calls)

    const result = await fetchYoutubeFeed('https://www.youtube.com/@RubyRangerr/videos')
    const feed = Array.isArray(result) ? result[0] : result

    // Sub-path trimmed, and no /channel/<id> lookup was needed to learn the handle.
    expect(feed?.url).toBe('https://www.youtube.com/@RubyRangerr')
    expect(calls.filter((c) => c.includes('/channel/'))).toHaveLength(0)
  })

  test('gives up rather than guessing when the page names no channel', async () => {
    vi.stubGlobal('fetch', async () => new Response('<html></html>', { status: 200 }))
    expect(await fetchYoutubeFeed('https://www.youtube.com/watch?v=abc123')).toBeUndefined()
  })
})

describe('fetchYoutubeFeed for a /channel/<id> URL', () => {
  // The feed itself was always found, but feed.url was left as the videos.xml
  // self-link, so the feed's home link pointed at the XML rather than the channel.
  test('shows the channel page, not the feed file', async () => {
    const calls: string[] = []
    stubFetch(calls, '<html><body>"canonicalBaseUrl":"/@RubyRangerr"</body></html>')

    const result = await fetchYoutubeFeed('https://www.youtube.com/channel/UC123')
    const feed = Array.isArray(result) ? result[0] : result

    expect(feed?.feedUrl).toBe('https://www.youtube.com/feeds/videos.xml?channel_id=UC123')
    expect(feed?.url).toBe('https://www.youtube.com/@RubyRangerr')
  })
})
