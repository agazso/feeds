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

  test('no feedName or siteIdentity: uses hostname fallback', () => {
    const result = createPost({
      url: 'https://example.com/post',
      metadata: {},
      originUrl: 'https://example.com',
    })
    expect(result.post.author.name).toBe('example.com')
  })
})
