import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  fetchRedditFeed,
  redditJsonFeedUrl,
  stripRedditPostChrome,
  toOldRedditUrl,
} from '../../src/providers/reddit'

describe('stripRedditPostChrome', () => {
  test('drops the "Posted in r/X by u/Y • N points and M comments" chrome', () => {
    expect(
      stripRedditPostChrome('Posted in r/pics by u/habsman9 • 34,684 points and 523 comments'),
    ).toBe('')
  })

  test('keeps a real text-post body', () => {
    const body = 'We’ve been talking for a while now about the work we’re doing to keep Reddit safe'
    expect(stripRedditPostChrome(body)).toBe(body)
  })

  test('does not strip a body that merely mentions a subreddit mid-sentence', () => {
    const body = 'I posted this earlier in r/pics and it got some comments worth reading'
    expect(stripRedditPostChrome(body)).toBe(body)
  })
})

describe('toOldRedditUrl', () => {
  const path = '/r/modnews/comments/1tq9vxo/title/'
  test('rewrites www, bare, and m subdomains to old.reddit.com', () => {
    expect(toOldRedditUrl(`https://www.reddit.com${path}`)).toBe(`https://old.reddit.com${path}`)
    expect(toOldRedditUrl(`https://reddit.com${path}`)).toBe(`https://old.reddit.com${path}`)
    expect(toOldRedditUrl(`https://m.reddit.com${path}`)).toBe(`https://old.reddit.com${path}`)
  })

  test('leaves an already-old URL unchanged', () => {
    expect(toOldRedditUrl(`https://old.reddit.com${path}`)).toBe(`https://old.reddit.com${path}`)
  })

  test('leaves non-reddit URLs unchanged', () => {
    expect(toOldRedditUrl('https://example.com/r/x')).toBe('https://example.com/r/x')
  })
})

describe('redditJsonFeedUrl', () => {
  test('converts a .rss feed URL to .json', () => {
    expect(redditJsonFeedUrl('https://www.reddit.com/r/linux.rss')).toBe(
      'https://www.reddit.com/r/linux.json',
    )
  })

  test('leaves a .json URL unchanged', () => {
    expect(redditJsonFeedUrl('https://www.reddit.com/r/linux.json')).toBe(
      'https://www.reddit.com/r/linux.json',
    )
  })

  test('appends /.json to a bare subreddit URL (canonicalized)', () => {
    expect(redditJsonFeedUrl('https://www.reddit.com/r/linux')).toBe(
      'https://www.reddit.com/r/linux/.json',
    )
  })

  test('appends .json when the URL already ends with a slash', () => {
    expect(redditJsonFeedUrl('https://www.reddit.com/r/linux/')).toBe(
      'https://www.reddit.com/r/linux/.json',
    )
  })
})

describe('fetchRedditFeed', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // Reddit's about.json now 403s (unauthenticated JSON API shut down); discovery must
  // fall back to the public .rss feed: subreddit slug name + hardcoded Reddit favicon.
  test('falls back to the .rss feed when about.json is blocked', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('403')
    })

    const feed = await fetchRedditFeed('https://www.reddit.com/r/hungary')
    expect(feed?.name).toBe('r/hungary')
    expect(feed?.feedUrl.endsWith('/r/hungary.rss')).toBe(true)
    expect(typeof feed?.favicon === 'string' && feed.favicon.length > 0).toBe(true)
  })
})
