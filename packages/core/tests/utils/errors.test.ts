import { afterEach, describe, expect, test, vi } from 'vitest'
import { fetchHtmlMetaDataOnly } from '../../src/parsers/html-metadata'
import { RateLimitError, isRateLimitError, isRateLimitStatus } from '../../src/utils/errors'
import { safeFetch } from '../../src/utils/fetch'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('RateLimitError', () => {
  test('names the host so the message says who is throttling', () => {
    const e = new RateLimitError('https://www.youtube.com/watch?v=abc', 429)
    expect(e.host).toBe('youtube.com')
    expect(e.status).toBe(429)
    expect(e.message).toContain('youtube.com')
    expect(e.message).toContain('429')
  })

  test('survives an unparseable url', () => {
    expect(new RateLimitError('not a url', 429).host).toBe('The site')
  })

  test('is recognisable, and nothing else is', () => {
    expect(isRateLimitError(new RateLimitError('https://a.test/', 429))).toBe(true)
    expect(isRateLimitError(new Error('Network error: 500'))).toBe(false)
    expect(isRateLimitError(undefined)).toBe(false)
  })

  test('covers the ask-again-later statuses only', () => {
    expect(isRateLimitStatus(429)).toBe(true)
    expect(isRateLimitStatus(503)).toBe(true)
    expect(isRateLimitStatus(404)).toBe(false)
    expect(isRateLimitStatus(200)).toBe(false)
  })
})

describe('fetchHtmlMetaDataOnly', () => {
  // YouTube answers a 429 with a captcha page: valid HTML, no feed in it. Parsing it
  // silently is what made a throttled request look like a page with no feed.
  test('throws rather than parsing a rate limit page', async () => {
    vi.stubGlobal(
      'fetch',
      async () => new Response('<html><head><title>Sorry…</title></head></html>', { status: 429 }),
    )
    await expect(fetchHtmlMetaDataOnly('https://www.youtube.com/watch?v=abc')).rejects.toThrow(
      /rate limiting/i,
    )
  })

  // Other failures still get parsed: several callers depend on reading whatever a
  // partial or error page carries.
  test('still parses a page that failed for another reason', async () => {
    vi.stubGlobal(
      'fetch',
      async () => new Response('<html><head><title>Gone</title></head></html>', { status: 404 }),
    )
    const meta = await fetchHtmlMetaDataOnly('https://example.com/x')
    expect(meta.title).toBe('Gone')
  })
})

describe('safeFetch', () => {
  test('throws the typed error for a rate limit', async () => {
    vi.stubGlobal('fetch', async () => new Response('slow down', { status: 429 }))
    await expect(safeFetch('https://example.com/feed')).rejects.toSatisfy(isRateLimitError)
  })

  test('still throws a plain error for other failures', async () => {
    vi.stubGlobal('fetch', async () => new Response('nope', { status: 500 }))
    const error = await safeFetch('https://example.com/feed').catch((e) => e)
    expect(isRateLimitError(error)).toBe(false)
    expect(error.message).toContain('500')
  })
})
