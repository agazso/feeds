import { describe, expect, test } from 'vitest'
import { formatAuthorName, createPost } from '../src/post-helpers'

describe('formatAuthorName', () => {
  test('combines name and author with separator', () => {
    expect(formatAuthorName('Site', 'Author')).toBe('Site | Author')
  })

  test('returns single value when name and author are identical', () => {
    expect(formatAuthorName('Andrew Nesbitt', 'Andrew Nesbitt')).toBe('Andrew Nesbitt')
  })

  test('returns name when no author', () => {
    expect(formatAuthorName('Site', undefined)).toBe('Site')
  })

  test('returns author when no name', () => {
    expect(formatAuthorName(undefined, 'Author')).toBe('Author')
  })

  test('returns fallback when no name or author', () => {
    expect(formatAuthorName(undefined, undefined, 'fallback.com')).toBe('fallback.com')
  })

  test('returns empty string when no name, author, or fallback', () => {
    expect(formatAuthorName(undefined, undefined, undefined)).toBe('')
  })

  test('hostname fallback is formatted (capitalized, no www)', () => {
    expect(formatAuthorName(undefined, undefined, 'Tropes.fyi')).toBe('Tropes.fyi')
    expect(formatAuthorName(undefined, undefined, 'Example.com')).toBe('Example.com')
  })
})

describe('createPost author name', () => {
  test('YouTube: uses feedName over generic siteIdentity (same host)', () => {
    const result = createPost({
      url: 'https://www.youtube.com/watch?v=abc123',
      metadata: { siteName: 'YouTube' },
      originUrl: 'https://www.youtube.com/@cobwebschannel',
      feedName: 'The Cobwebs Channel',
    })
    expect(result.post.author.name).toBe('The Cobwebs Channel')
  })

  test('YouTube share: channel resolved into metadata.name attributes to channel', () => {
    // fetchEnrichedMetadata sets name=author=channel (via oEmbed) for YouTube shares
    const result = createPost({
      url: 'https://www.youtube.com/watch?v=abc123',
      metadata: { name: 'The Cobwebs Channel', siteName: 'YouTube', author: 'The Cobwebs Channel' },
      originUrl: 'https://www.youtube.com',
    })
    expect(result.post.author.name).toBe('The Cobwebs Channel')
  })

  test('Hacker News: uses siteIdentity from external article (different host)', () => {
    const result = createPost({
      url: 'https://techcrunch.com/article',
      metadata: { siteName: 'TechCrunch', author: 'Jane Doe' },
      originUrl: 'https://news.ycombinator.com',
      feedName: 'Hacker News',
    })
    expect(result.post.author.name).toBe('TechCrunch | Jane Doe')
  })

  test('Regular blog: uses siteIdentity when no feedName', () => {
    const result = createPost({
      url: 'https://example.com/post',
      metadata: { siteName: 'Example Blog', author: 'John' },
      originUrl: 'https://example.com',
    })
    expect(result.post.author.name).toBe('Example Blog | John')
  })

  test('Non-YouTube same host with feedName: uses siteIdentity', () => {
    const result = createPost({
      url: 'https://example.com/post',
      metadata: { siteName: 'Example' },
      originUrl: 'https://example.com',
      feedName: 'Example Blog Feed',
    })
    // feedName is only used for YouTube URLs
    expect(result.post.author.name).toBe('Example')
  })

  test('feedName same as siteIdentity: uses siteIdentity', () => {
    const result = createPost({
      url: 'https://example.com/post',
      metadata: { siteName: 'Example', author: 'John' },
      originUrl: 'https://example.com',
      feedName: 'Example',
    })
    expect(result.post.author.name).toBe('Example | John')
  })

  test('handles www prefix difference correctly', () => {
    const result = createPost({
      url: 'https://www.youtube.com/watch?v=abc123',
      metadata: { siteName: 'YouTube' },
      originUrl: 'https://youtube.com/@channel',
      feedName: 'Channel Name',
    })
    expect(result.post.author.name).toBe('Channel Name')
  })

  test('aggregator with external link uses article siteIdentity', () => {
    const result = createPost({
      url: 'https://arstechnica.com/science/article',
      metadata: { name: 'Ars Technica', author: 'Staff Writer' },
      originUrl: 'https://lobste.rs',
      feedName: 'Lobsters',
    })
    expect(result.post.author.name).toBe('Ars Technica | Staff Writer')
  })

  test('no feedName or siteIdentity: uses formatted hostname fallback', () => {
    const result = createPost({
      url: 'https://example.com/post',
      metadata: {},
      originUrl: 'https://example.com',
    })
    expect(result.post.author.name).toBe('Example.com')
  })

  test('YouTube from aggregator (HN): uses siteIdentity not feedName', () => {
    const result = createPost({
      url: 'https://www.youtube.com/watch?v=abc123',
      metadata: { siteName: 'YouTube' },
      originUrl: 'https://news.ycombinator.com',
      feedName: 'Hacker News',
    })
    // YouTube videos from HN should show "YouTube", not "Hacker News"
    expect(result.post.author.name).toBe('YouTube')
  })

  test('external article no metadata: uses formatted hostname (not feedName)', () => {
    const result = createPost({
      url: 'https://blocked-site.com/article',
      metadata: {}, // Empty metadata (e.g., captcha page)
      originUrl: 'https://news.ycombinator.com',
      feedName: 'Hacker News',
    })
    // External articles without metadata show their hostname, not the aggregator name
    expect(result.post.author.name).toBe('Blocked-site.com')
  })

  test('same-host article no metadata: uses feedName', () => {
    const result = createPost({
      url: 'https://news.ycombinator.com/item?id=12345',
      metadata: {}, // HN self-post with no metadata
      originUrl: 'https://news.ycombinator.com',
      feedName: 'Hacker News',
    })
    // Same-host posts can fall back to feedName
    expect(result.post.author.name).toBe('Hacker News')
  })
})

describe('createPost comments link', () => {
  test('adds comments link when rssItem has comments', () => {
    const result = createPost({
      url: 'https://example.com/article',
      metadata: { title: 'Article Title', description: 'Description' },
      originUrl: 'https://news.ycombinator.com',
      feedName: 'Hacker News',
      rssItem: {
        title: 'Article Title',
        link: 'https://example.com/article',
        comments: 'https://news.ycombinator.com/item?id=12345',
      },
    })
    expect(result.post.text).toContain('[Comments](https://news.ycombinator.com/item?id=12345)')
  })

  test('no comments link when rssItem has no comments field', () => {
    const result = createPost({
      url: 'https://example.com/article',
      metadata: { title: 'Article Title', description: 'Description' },
      originUrl: 'https://example.com',
      rssItem: {
        title: 'Article Title',
        link: 'https://example.com/article',
      },
    })
    expect(result.post.text).not.toContain('[Comments]')
  })

  test('no comments link when no rssItem', () => {
    const result = createPost({
      url: 'https://example.com/article',
      metadata: { title: 'Article Title', description: 'Description' },
      originUrl: 'https://example.com',
    })
    expect(result.post.text).not.toContain('[Comments]')
  })
})

describe('createPost text from an RSS item', () => {
  // A link whose page yields no description of its own — a PDF, say — falls back to the
  // RSS item. That description is HTML and must reach the markdown text as markdown.
  const rssItem = {
    title: "Economics Nobel Laureates' Letter [pdf]",
    description: '<a href="https://news.ycombinator.com/item?id=1">Comments</a>',
    link: 'https://example.org/paper.pdf',
    url: 'https://example.org/paper.pdf',
    created: 0,
    comments: 'https://news.ycombinator.com/item?id=1',
  }

  test('converts the html description instead of embedding it raw', () => {
    const { post } = createPost({
      url: 'https://example.org/paper.pdf',
      metadata: {},
      originUrl: 'https://news.ycombinator.com/',
      feedName: 'Hacker News',
      rssItem,
    })
    expect(post.text).not.toMatch(/<[a-z][^>]*>/i)
    expect(post.text).toContain('[Comments](https://news.ycombinator.com/item?id=1)')
  })

  test('keeps the title, and leaves a real description readable', () => {
    const { post } = createPost({
      url: 'https://example.org/paper.pdf',
      metadata: {},
      originUrl: 'https://news.ycombinator.com/',
      feedName: 'Hacker News',
      rssItem: { ...rssItem, description: '<p>Some &amp; body text</p>' },
    })
    expect(post.text).toContain("**Economics Nobel Laureates' Letter [pdf]**")
    expect(post.text).toContain('Some & body text')
    expect(post.text).not.toMatch(/<[a-z][^>]*>/i)
  })
})
