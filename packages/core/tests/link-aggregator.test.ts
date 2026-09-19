import { describe, expect, test } from 'vitest'
import { looksLikeLinkAggregator } from '../src/discover-feed'
import type { RSSItem } from '../src/models/rss'

const item = (link: string): RSSItem => ({
  title: 't',
  description: '',
  link,
  url: link,
  created: 0,
})

describe('looksLikeLinkAggregator', () => {
  test('flags a feed whose items point at other sites', () => {
    const hn = [
      item('https://example.com/a'),
      item('https://other.org/b'),
      item('https://third.net/c'),
      item('https://news.ycombinator.com/item?id=1'), // an occasional self-post
    ]
    expect(looksLikeLinkAggregator(hn, 'https://news.ycombinator.com/rss')).toBe(true)
  })

  test('leaves a normal blog alone', () => {
    const blog = [
      item('https://blog.example.com/one'),
      item('https://blog.example.com/two'),
      item('https://blog.example.com/three'),
    ]
    expect(looksLikeLinkAggregator(blog, 'https://blog.example.com/feed.xml')).toBe(false)
  })

  test('leaves YouTube and Reddit alone — their items link to themselves', () => {
    const youtube = Array.from({ length: 5 }, (_, i) =>
      item(`https://www.youtube.com/watch?v=${i}`),
    )
    expect(
      looksLikeLinkAggregator(youtube, 'https://www.youtube.com/feeds/videos.xml?channel_id=X'),
    ).toBe(false)

    const reddit = Array.from({ length: 5 }, (_, i) =>
      item(`https://www.reddit.com/r/x/comments/${i}/title/`),
    )
    expect(looksLikeLinkAggregator(reddit, 'https://www.reddit.com/r/x/.rss')).toBe(false)
  })

  test('ignores www and subdomain-free host differences', () => {
    const items = Array.from({ length: 4 }, (_, i) => item(`https://www.example.com/${i}`))
    expect(looksLikeLinkAggregator(items, 'https://example.com/feed')).toBe(false)
  })

  test('needs enough items to judge, and survives junk input', () => {
    expect(looksLikeLinkAggregator([item('https://other.org/a')], 'https://example.com/f')).toBe(
      false,
    )
    expect(looksLikeLinkAggregator([], 'https://example.com/f')).toBe(false)
    const withJunk = [item(''), item('not a url'), item('https://a.com/1'), item('https://b.com/2')]
    expect(() => looksLikeLinkAggregator(withJunk, 'https://example.com/f')).not.toThrow()
  })
})
