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
