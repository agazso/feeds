import type { Feed } from '@feeds/core'
import { describe, expect, test } from 'vitest'
import { opmlFilename, opmlResponse } from '../src/lib/server/opml'

function makeFeed(over: Partial<Feed> = {}): Feed {
  return {
    name: 'Example',
    url: 'https://example.com/',
    feedUrl: 'https://example.com/feed.xml',
    favicon: '',
    ...over,
  }
}

describe('opmlResponse', () => {
  test('is served as a download with the right name', async () => {
    const res = opmlResponse([makeFeed()], 'feeds-music', 'Feeds — music')
    expect(res.headers.get('content-type')).toBe('text/x-opml; charset=utf-8')
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="feeds-music.opml"')
    const body = await res.text()
    expect(body).toContain('<title>Feeds — music</title>')
    expect(body).toContain('xmlUrl="https://example.com/feed.xml"')
  })
})

describe('opmlFilename', () => {
  test('names the file after the selected tags', () => {
    expect(opmlFilename(['music'])).toBe('feeds-music')
    expect(opmlFilename(['music', 'guitar'])).toBe('feeds-music-guitar')
  })

  test('is just feeds when nothing is selected', () => {
    expect(opmlFilename([])).toBe('feeds')
  })

  // A tag is free text, and it ends up in a Content-Disposition filename.
  test('strips anything that has no business in a filename', () => {
    expect(opmlFilename(['Sci-Fi & Fantasy'])).toBe('feeds-sci-fi-fantasy')
    expect(opmlFilename(['../../etc/passwd'])).toBe('feeds-etc-passwd')
    expect(opmlFilename(['a"b'])).toBe('feeds-a-b')
    expect(opmlFilename(['...'])).toBe('feeds')
  })
})
