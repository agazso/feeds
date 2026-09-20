import type { Post } from '@feeds/core'
import { describe, expect, test } from 'vitest'
import { SHORT_TAG, isShortLink, tagShorts } from '../src/lib/shorts'

function makePost(link: string | undefined, tags?: string[]): Post {
  return { _id: link ?? 'x', text: '', images: [], createdAt: 0, link, tags }
}

describe('isShortLink', () => {
  test('true for a /shorts/ link', () => {
    expect(isShortLink('https://www.youtube.com/shorts/0-8AK7Ma-Kc')).toBe(true)
  })
  test('false for a regular watch link or missing link', () => {
    expect(isShortLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(false)
    expect(isShortLink(undefined)).toBe(false)
  })
})

describe('tagShorts', () => {
  test('adds the short tag to Shorts, leaves others and preserves existing tags', () => {
    const posts = tagShorts([
      makePost('https://www.youtube.com/shorts/abc', ['funny']),
      makePost('https://www.youtube.com/watch?v=xyz'),
    ])
    expect(posts[0].tags).toEqual(['funny', SHORT_TAG])
    expect(posts[1].tags).toBeUndefined()
  })
})
